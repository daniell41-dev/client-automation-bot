import { describe, expect, it } from "vitest";
import { interpretableOptions, respond } from "@/core/engine/responder";
import type { BusinessConfig, IncomingMessage } from "@/core/types";

const config: BusinessConfig = {
  slug: "test",
  name: "Estética Test",
  currency: "COP",
  locale: "es-CO",
  services: [
    {
      id: "limpieza-facial",
      name: "Limpieza facial",
      description: "Limpieza profunda con extracción",
      price: 120000,
      durationMinutes: 60,
      keywords: ["facial", "limpieza"],
    },
    {
      id: "unas",
      name: "Uñas",
      description: "Manicure semipermanente",
      price: 60000,
      durationMinutes: 45,
      keywords: ["manicure", "unas"],
    },
  ],
  messages: {
    welcome: "¡Hola! ¿Qué servicio te interesa?",
    askName: "¿Cuál es tu nombre?",
    askDate: "¿Qué día te gustaría agendar?",
    askConfirm: "¿Confirmo tu cita de {{servicio}} para {{fecha}}?",
    serviceInfo: "{{servicio}}: {{descripcion}}. Precio {{precio}}, dura {{duracion}}.",
    captured: "Perfecto {{nombre}}, tu cita de {{servicio}} para {{fecha}} quedó agendada.",
    fallback: "No te entendí 😅. ¿Qué servicio te interesa?",
  },
  followUps: [],
};

function msg(text: string, timestamp = "2026-06-21T10:00:00.000Z"): IncomingMessage {
  return {
    channel: "mock",
    businessSlug: "test",
    from: "57300000000",
    text,
    timestamp,
  };
}

const now = new Date("2026-06-21T10:00:00.000Z");

describe("respond — primer contacto", () => {
  it("ante un saludo sin servicio, envía el menú de bienvenida", () => {
    const { lead, messages } = respond(null, msg("Hola"), config, now);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain("¿Qué servicio te interesa?");
    expect(messages[0].options).toEqual(["Limpieza facial", "Uñas"]);
    expect(lead.state).toBe("nuevo");
    expect(lead.stage).toBe("menu_enviado");
  });

  it("si el primer mensaje ya menciona un servicio, da info y pide el nombre en un solo mensaje", () => {
    const { lead, messages } = respond(
      null,
      msg("Hola, quiero info de limpieza facial"),
      config,
      now,
    );
    // Info del servicio + pregunta del nombre van en UNA sola burbuja.
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain("Limpieza facial");
    expect(messages[0].text).toContain("120.000");
    expect(messages[0].text).toContain("60 minutos");
    expect(messages[0].text).toContain("¿Cuál es tu nombre?");
    expect(lead.state).toBe("interesado");
    expect(lead.serviceId).toBe("limpieza-facial");
    expect(lead.stage).toBe("esperando_nombre");
  });
});

describe("respond — flujo completo de captura", () => {
  it("captura servicio → nombre → fecha → confirmación y agenda", () => {
    // 1) Elige servicio
    let r = respond(null, msg("limpieza facial"), config, now);
    expect(r.lead.stage).toBe("esperando_nombre");

    // 2) Responde el nombre
    r = respond(r.lead, msg("Laura Pérez"), config, now);
    expect(r.lead.name).toBe("Laura Pérez");
    expect(r.lead.stage).toBe("esperando_fecha");
    expect(r.messages[0].text).toContain("¿Qué día");

    // 3) Responde la fecha → el bot pide confirmación (aún interesado)
    r = respond(r.lead, msg("el viernes"), config, now);
    expect(r.lead.tentativeDate).toBe("el viernes");
    expect(r.lead.stage).toBe("esperando_confirmacion");
    expect(r.lead.state).toBe("interesado");
    expect(r.messages[0].text).toContain("Limpieza facial");
    expect(r.messages[0].text).toContain("el viernes");
    expect(r.messages[0].options).toEqual(["Sí, confirmar", "Cambiar fecha"]);

    // 4) Confirma → cita agendada
    r = respond(r.lead, msg("sí"), config, now);
    expect(r.lead.stage).toBe("datos_completos");
    expect(r.lead.state).toBe("agendado");
    expect(r.messages[0].text).toContain("Laura Pérez");
    expect(r.messages[0].text).toContain("agendada");
  });

  it("si declina la confirmación, vuelve a pedir la fecha sin agendar", () => {
    let r = respond(null, msg("limpieza facial"), config, now);
    r = respond(r.lead, msg("Laura Pérez"), config, now);
    r = respond(r.lead, msg("el viernes"), config, now);
    expect(r.lead.stage).toBe("esperando_confirmacion");

    // Cualquier cosa que no sea "sí" → cambiar fecha
    r = respond(r.lead, msg("Cambiar fecha"), config, now);
    expect(r.lead.stage).toBe("esperando_fecha");
    expect(r.lead.state).toBe("interesado");
    expect(r.messages[0].text).toContain("¿Qué día");
  });

  it("selección por número de menú funciona tras el menú", () => {
    let r = respond(null, msg("Hola"), config, now);
    r = respond(r.lead, msg("2"), config, now);
    expect(r.lead.serviceId).toBe("unas");
    expect(r.lead.stage).toBe("esperando_nombre");
  });
});


describe("respond — fecha natural (español de chat)", () => {
  it("limpia muletillas y puntuación antes de guardar la fecha", () => {
    let r = respond(null, msg("limpieza facial"), config, now);
    r = respond(r.lead, msg("Laura"), config, now);

    r = respond(r.lead, msg("Puede ser hoy ?"), config, now);
    expect(r.lead.tentativeDate).toBe("hoy");
    expect(r.lead.stage).toBe("esperando_confirmacion");
    expect(r.messages[0].text).toBe("¿Confirmo tu cita de Limpieza facial para hoy?");
  });

  it("expande abreviaturas y conserva tildes de palabras normales", () => {
    let r = respond(null, msg("limpieza facial"), config, now);
    r = respond(r.lead, msg("Laura"), config, now);

    r = respond(r.lead, msg("Podría ser mñn en la tarde"), config, now);
    expect(r.lead.tentativeDate).toBe("mañana en la tarde");
  });

  it("si la fecha queda vacía (solo puntuación/muletillas), re-pregunta sin cambiar de etapa", () => {
    let r = respond(null, msg("limpieza facial"), config, now);
    r = respond(r.lead, msg("Laura"), config, now);

    r = respond(r.lead, msg("???"), config, now);
    expect(r.lead.stage).toBe("esperando_fecha");
    expect(r.lead.tentativeDate).toBeUndefined();
    expect(r.messages[0].text).toContain("¿Qué día");

    // El cliente responde bien en el siguiente mensaje y el flujo sigue.
    r = respond(r.lead, msg("el viernes"), config, now);
    expect(r.lead.tentativeDate).toBe("el viernes");
    expect(r.lead.stage).toBe("esperando_confirmacion");
  });

  it("reconoce el servicio y la confirmación aunque el cliente escriba mal todo el camino", () => {
    let r = respond(null, msg("hla, kiero info d unas xfa"), config, now);
    expect(r.lead.serviceId).toBe("unas");
    expect(r.lead.stage).toBe("esperando_nombre");

    r = respond(r.lead, msg("Carlos"), config, now);
    r = respond(r.lead, msg("puede ser hy"), config, now);
    expect(r.lead.tentativeDate).toBe("hoy");

    r = respond(r.lead, msg("siii dale"), config, now);
    expect(r.lead.stage).toBe("datos_completos");
    expect(r.lead.state).toBe("agendado");
  });
});

describe("respond — fallback", () => {
  it("responde fallback cuando no entiende (y ya pasó el inicio)", () => {
    let r = respond(null, msg("Hola"), config, now);
    r = respond(r.lead, msg("xyz123 no se"), config, now);
    expect(r.messages[0].text).toContain("No te entendí");
    expect(r.messages[0].options).toEqual(["Limpieza facial", "Uñas"]);
  });
});

describe("respond — reglas rápidas y disponibilidad", () => {
  const configConReglas: BusinessConfig = {
    ...config,
    services: [
      ...config.services,
      {
        id: "apagado",
        name: "Servicio apagado",
        description: "No disponible",
        price: 1000,
        durationMinutes: 30,
        disponible: false,
      },
    ],
    ai: {
      enabled: true,
      reglas: [
        { keywords: ["horario", "abren"], respuesta: "Atendemos de 9 a 20 h." },
      ],
    },
  };

  it("una keyword de regla responde EXACTO la regla (prioridad sobre el fallback)", () => {
    const inicial = respond(null, msg("Hola"), configConReglas, now).lead;
    const { lead, messages } = respond(
      inicial,
      msg("¿a qué hora abren?"),
      configConReglas,
      now,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("Atendemos de 9 a 20 h.");
    // La regla no altera el funnel.
    expect(lead.stage).toBe("menu_enviado");
  });

  it("la regla también responde en el primer contacto (antes que el menú)", () => {
    const { messages } = respond(null, msg("horario?"), configConReglas, now);
    expect(messages[0].text).toBe("Atendemos de 9 a 20 h.");
  });

  it("la captura de datos tiene prioridad sobre las reglas", () => {
    const paso1 = respond(null, msg("limpieza facial"), configConReglas, now).lead;
    // El lead está en esperando_nombre: "horario" se toma como su nombre, no
    // como regla (las etapas de captura van primero).
    const { lead } = respond(paso1, msg("Horario"), configConReglas, now);
    expect(lead.name).toBe("Horario");
  });

  it("el menú de bienvenida no ofrece servicios no disponibles", () => {
    const { messages } = respond(null, msg("Hola"), configConReglas, now);
    expect(messages[0].options).toEqual(["Limpieza facial", "Uñas"]);
  });
});

describe("respond — modalidad de pedido (retirar / comer en el local)", () => {
  const configConPedidos: BusinessConfig = {
    ...config,
    pedidos: {
      enabled: true,
      pregunta: "¿Retirás en el local o comés acá?",
      opciones: ["Retirar en el local", "Comer aquí"],
    },
  };

  it("tras el nombre, pregunta la modalidad ANTES de la fecha", () => {
    const paso1 = respond(null, msg("limpieza facial"), configConPedidos, now).lead;
    const { lead, messages } = respond(paso1, msg("Laura"), configConPedidos, now);

    expect(lead.stage).toBe("esperando_entrega");
    expect(messages[0].text).toBe("¿Retirás en el local o comés acá?");
    expect(messages[0].options).toEqual(["Retirar en el local", "Comer aquí"]);
  });

  it("guarda la modalidad elegida y continúa a la fecha", () => {
    const paso1 = respond(null, msg("limpieza facial"), configConPedidos, now).lead;
    const paso2 = respond(paso1, msg("Laura"), configConPedidos, now).lead;
    const { lead, messages } = respond(paso2, msg("retiro en el local"), configConPedidos, now);

    expect(lead.entrega).toBe("Retirar en el local");
    expect(lead.stage).toBe("esperando_fecha");
    expect(messages[0].text).toContain("día");
  });

  it("el flujo completo llega a agendado con la modalidad guardada", () => {
    let lead = respond(null, msg("limpieza facial"), configConPedidos, now).lead;
    lead = respond(lead, msg("Laura"), configConPedidos, now).lead;
    lead = respond(lead, msg("2"), configConPedidos, now).lead; // "Comer aquí" por número
    expect(lead.entrega).toBe("Comer aquí");
    lead = respond(lead, msg("mañana"), configConPedidos, now).lead;
    expect(lead.stage).toBe("esperando_confirmacion");

    const { lead: final } = respond(lead, msg("sí"), configConPedidos, now);
    expect(final.state).toBe("agendado");
    expect(final.stage).toBe("datos_completos");
    expect(final.entrega).toBe("Comer aquí");
  });

  it("sin pedidos configurado, el flujo NO pregunta modalidad (regresión)", () => {
    const paso1 = respond(null, msg("limpieza facial"), config, now).lead;
    const { lead } = respond(paso1, msg("Laura"), config, now);
    expect(lead.stage).toBe("esperando_fecha");
    expect(lead.entrega).toBeUndefined();
  });
});

describe("respond — señal unrecognized (red de seguridad de la IA)", () => {
  it("NO marca unrecognized cuando reconoce el servicio o el saludo", () => {
    expect(respond(null, msg("Hola"), config, now).unrecognized).toBeFalsy();
    expect(respond(null, msg("limpieza facial"), config, now).unrecognized).toBeFalsy();
  });

  it("marca unrecognized cuando cae al fallback", () => {
    // Un lead nuevo (stage "inicio") siempre recibe el menú de bienvenida,
    // así que primero hay que pasar ese paso para llegar al fallback real.
    let r = respond(null, msg("Hola"), config, now);
    r = respond(r.lead, msg("asdkjhaskjdh"), config, now);
    expect(r.messages[0].text).toContain("No te entendí");
    expect(r.unrecognized).toBe(true);
  });

  it("marca unrecognized en esperando_entrega si no reconoce ninguna opción", () => {
    const configConPedidos: BusinessConfig = {
      ...config,
      pedidos: {
        enabled: true,
        pregunta: "¿Retirás o comés acá?",
        opciones: ["Retirar en el local", "Comer aquí"],
      },
    };
    let r = respond(null, msg("limpieza facial"), configConPedidos, now);
    r = respond(r.lead, msg("Laura"), configConPedidos, now);
    expect(r.lead.stage).toBe("esperando_entrega");

    const sinMatch = respond(r.lead, msg("no sé, sorpréndeme"), configConPedidos, now);
    expect(sinMatch.unrecognized).toBe(true);
    expect(sinMatch.lead.entrega).toBe("no sé, sorpréndeme"); // igual acepta el texto

    const conMatch = respond(r.lead, msg("prefiero retirar"), configConPedidos, now);
    expect(conMatch.unrecognized).toBeFalsy();
    expect(conMatch.lead.entrega).toBe("Retirar en el local");
  });
});

describe("interpretableOptions", () => {
  it("en esperando_entrega devuelve las opciones de pedidos", () => {
    const configConPedidos: BusinessConfig = {
      ...config,
      pedidos: {
        enabled: true,
        pregunta: "¿?",
        opciones: ["Retirar en el local", "Comer aquí"],
      },
    };
    expect(interpretableOptions("esperando_entrega", configConPedidos)).toEqual([
      "Retirar en el local",
      "Comer aquí",
    ]);
  });

  it("en cualquier otra etapa devuelve los servicios disponibles", () => {
    expect(interpretableOptions("menu_enviado", config)).toEqual([
      "Limpieza facial",
      "Uñas",
    ]);
    expect(interpretableOptions(undefined, config)).toEqual([
      "Limpieza facial",
      "Uñas",
    ]);
  });

  it("suma los botonesMenu configurados, sin duplicar", () => {
    const configConBotones: BusinessConfig = {
      ...config,
      ai: { enabled: true, botonesMenu: ["Ver precios", "Uñas"] },
    };
    expect(interpretableOptions("menu_enviado", configConBotones)).toEqual([
      "Limpieza facial",
      "Uñas",
      "Ver precios",
    ]);
  });
});
