import { describe, expect, it } from "vitest";
import { interpretableOptions, respond } from "@/core/engine/responder";
import type { BusinessConfig, IncomingMessage, Lead } from "@/core/types";

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

describe("respond — el bot no debe secuestrar mensajes que no son la respuesta esperada", () => {
  it("reproduce el bug reportado: saludo y pedido de menú en esperando_confirmacion no rompen el flujo", () => {
    let r = respond(null, msg("uñas"), config, now);
    r = respond(r.lead, msg("Carlos"), config, now);
    r = respond(r.lead, msg("hoy"), config, now);
    expect(r.lead.stage).toBe("esperando_confirmacion");
    expect(r.lead.tentativeDate).toBe("hoy");

    // Interrupción 1: saludo — NO debe tocar la fecha ni la etapa.
    r = respond(r.lead, msg("Hola buenas tardes"), config, now);
    expect(r.lead.stage).toBe("esperando_confirmacion");
    expect(r.lead.tentativeDate).toBe("hoy");
    expect(r.messages[0].text).toContain("hoy"); // repite la pregunta de confirmación

    // Interrupción 2: pedido de menú — tampoco debe tocar la fecha ni la etapa.
    r = respond(r.lead, msg("Me repites por fa las opciones que hay"), config, now);
    expect(r.lead.stage).toBe("esperando_confirmacion");
    expect(r.lead.tentativeDate).toBe("hoy");
    expect(r.messages[0].text).toContain("Limpieza facial");
    expect(r.messages[0].text).toContain("Uñas");

    // El flujo sigue vivo: confirmar todavía funciona.
    r = respond(r.lead, msg("sí"), config, now);
    expect(r.lead.stage).toBe("datos_completos");
    expect(r.lead.state).toBe("agendado");
  });

  it("un pedido de menú en esperando_fecha no queda guardado como fecha", () => {
    let r = respond(null, msg("uñas"), config, now);
    r = respond(r.lead, msg("Carlos"), config, now);
    expect(r.lead.stage).toBe("esperando_fecha");

    r = respond(r.lead, msg("Me repites por fa las opciones que hay"), config, now);
    expect(r.lead.stage).toBe("esperando_fecha"); // sigue esperando la fecha
    expect(r.lead.tentativeDate).toBeUndefined();
    expect(r.messages[0].text).toContain("Limpieza facial");
    expect(r.messages[0].text).toContain("¿Qué día");
  });

  it("un saludo en esperando_fecha no queda guardado como fecha", () => {
    let r = respond(null, msg("uñas"), config, now);
    r = respond(r.lead, msg("Carlos"), config, now);

    r = respond(r.lead, msg("hola, buenas tardes"), config, now);
    expect(r.lead.stage).toBe("esperando_fecha");
    expect(r.lead.tentativeDate).toBeUndefined();
    expect(r.messages[0].text).toContain("¿Qué día");
  });

  it("texto que no parece fecha ni interrupción reconocida re-pregunta (no inventa una fecha)", () => {
    let r = respond(null, msg("uñas"), config, now);
    r = respond(r.lead, msg("Carlos"), config, now);

    r = respond(r.lead, msg("no se todavia"), config, now);
    expect(r.lead.stage).toBe("esperando_fecha");
    expect(r.lead.tentativeDate).toBeUndefined();
  });

  it("un saludo en esperando_nombre no queda guardado como nombre", () => {
    const r = respond(
      { ...respond(null, msg("uñas"), config, now).lead },
      msg("Hola, buenas"),
      config,
      now,
    );
    expect(r.lead.stage).toBe("esperando_nombre");
    expect(r.lead.name).toBeUndefined();
    expect(r.messages[0].text).toContain("¿Cuál es tu nombre?");
  });

  it("en esperando_confirmacion, una fecha nueva directa ('mejor el sábado') actualiza sin re-preguntar aparte", () => {
    let r = respond(null, msg("uñas"), config, now);
    r = respond(r.lead, msg("Carlos"), config, now);
    r = respond(r.lead, msg("hoy"), config, now);
    expect(r.lead.stage).toBe("esperando_confirmacion");

    r = respond(r.lead, msg("mejor el sábado"), config, now);
    expect(r.lead.tentativeDate).toBe("el sábado");
    expect(r.lead.stage).toBe("esperando_confirmacion");
    expect(r.messages[0].text).toContain("el sábado");
  });

  it("en esperando_confirmacion, algo genuinamente ambiguo sigue mandando a esperando_fecha (regresión)", () => {
    let r = respond(null, msg("uñas"), config, now);
    r = respond(r.lead, msg("Carlos"), config, now);
    r = respond(r.lead, msg("hoy"), config, now);

    r = respond(r.lead, msg("Cambiar fecha"), config, now);
    expect(r.lead.stage).toBe("esperando_fecha");
  });

  // Regresión de punta a punta: "¿cuánto sale?" daba por confirmada la cita,
  // lo que además dispara el evento de calendario y el aviso a la dueña en
  // `handleIncoming`. El cliente preguntaba el precio y salía agendado.
  it("en esperando_confirmacion, una pregunta de precio NO confirma la cita", () => {
    for (const pregunta of ["¿cuánto sale?", "¿cuánto vale?", "¿a qué hora sale?"]) {
      let r = respond(null, msg("uñas"), config, now);
      r = respond(r.lead, msg("Carlos"), config, now);
      r = respond(r.lead, msg("hoy"), config, now);
      expect(r.lead.stage).toBe("esperando_confirmacion");

      r = respond(r.lead, msg(pregunta), config, now);
      expect(r.lead.stage).not.toBe("datos_completos");
      expect(r.lead.state).not.toBe("agendado");
    }
  });
});

describe("respond — cita vigente tras confirmar (T-20)", () => {
  function leadConfirmado() {
    let r = respond(null, msg("limpieza facial"), config, now);
    r = respond(r.lead, msg("Laura"), config, now);
    r = respond(r.lead, msg("el viernes"), config, now);
    r = respond(r.lead, msg("sí"), config, now);
    expect(r.lead.stage).toBe("datos_completos");
    return r.lead;
  }

  it("un saludo NO baja el stage ni re-manda el menú: recuerda la cita vigente", () => {
    const confirmado = leadConfirmado();
    const { lead, messages } = respond(confirmado, msg("Hola"), config, now);

    expect(lead.stage).toBe("datos_completos"); // antes del fix, caía a "menu_enviado"
    expect(lead.serviceId).toBe("limpieza-facial");
    expect(lead.tentativeDate).toBe("el viernes");
    expect(messages[0].options).toBeUndefined(); // no se re-manda el menú
    expect(messages[0].text).toContain("Limpieza facial");
    expect(messages[0].text).toContain("el viernes");
  });

  it("un mensaje cualquiera que no matchea nada usa el default de citaVigente", () => {
    const confirmado = leadConfirmado();
    const { lead, messages } = respond(confirmado, msg("gracias!"), config, now);

    expect(lead.stage).toBe("datos_completos");
    expect(messages[0].text).toContain("Laura");
  });

  // Regresión: un número suelto en una despedida se tomaba como "elegir el
  // servicio 2", y este bloque limpia fecha y modalidad para la reserva nueva
  // — o sea, la cita confirmada perdía la fecha por un "nos vemos el 2".
  it("una despedida con un número NO se toma como una reserva nueva", () => {
    const confirmado = leadConfirmado();
    const { lead } = respond(confirmado, msg("gracias, nos vemos el 2"), config, now);

    expect(lead.stage).toBe("datos_completos");
    expect(lead.serviceId).toBe("limpieza-facial");
    expect(lead.tentativeDate).toBe("el viernes");
  });

  it("con messages.citaVigente configurado, usa ESE texto en vez del default", () => {
    const configConCitaVigente: BusinessConfig = {
      ...config,
      messages: { ...config.messages, citaVigente: "Tu turno de {{servicio}} sigue en pie." },
    };
    let r = respond(null, msg("limpieza facial"), configConCitaVigente, now);
    r = respond(r.lead, msg("Laura"), configConCitaVigente, now);
    r = respond(r.lead, msg("el viernes"), configConCitaVigente, now);
    r = respond(r.lead, msg("sí"), configConCitaVigente, now);

    const { messages } = respond(r.lead, msg("Hola"), configConCitaVigente, now);
    expect(messages[0].text).toBe("Tu turno de Limpieza facial sigue en pie.");
  });

  it("una regla rápida responde igual que siempre, sin tocar la cita", () => {
    const configConReglas: BusinessConfig = {
      ...config,
      ai: { enabled: true, reglas: [{ keywords: ["horario"], respuesta: "Atendemos 9 a 20 h." }] },
    };
    let r = respond(null, msg("limpieza facial"), configConReglas, now);
    r = respond(r.lead, msg("Laura"), configConReglas, now);
    r = respond(r.lead, msg("el viernes"), configConReglas, now);
    r = respond(r.lead, msg("sí"), configConReglas, now);

    const { lead, messages } = respond(r.lead, msg("¿a qué horario abren?"), configConReglas, now);
    expect(messages[0].text).toBe("Atendemos 9 a 20 h.");
    expect(lead.stage).toBe("datos_completos");
    expect(lead.serviceId).toBe("limpieza-facial");
  });

  it("elegir OTRO servicio arranca una reserva nueva: limpia la fecha vieja y pide fecha de nuevo", () => {
    const confirmado = leadConfirmado();
    const { lead, messages } = respond(confirmado, msg("uñas"), config, now);

    expect(lead.serviceId).toBe("unas");
    expect(lead.tentativeDate).toBeUndefined(); // la fecha del viernes ya no aplica
    expect(lead.name).toBe("Laura"); // el nombre SÍ se conserva
    expect(lead.stage).toBe("esperando_fecha");
    expect(messages[0].text).toContain("Uñas");
    expect(messages[0].text).toContain("¿Qué día");

    // Y el flujo se puede completar de nuevo con normalidad.
    const final = respond(respond(lead, msg("mañana"), config, now).lead, msg("sí"), config, now).lead;
    expect(final.stage).toBe("datos_completos");
    expect(final.serviceId).toBe("unas");
    expect(final.tentativeDate).toBe("mañana");
  });

  it("elegir otro servicio con pedidos habilitado vuelve a preguntar la modalidad (no reusa la vieja)", () => {
    const configConPedidos: BusinessConfig = {
      ...config,
      pedidos: {
        enabled: true,
        pregunta: "¿Retirás en el local o comés acá?",
        opciones: ["Retirar en el local", "Comer aquí"],
      },
    };
    let r = respond(null, msg("limpieza facial"), configConPedidos, now);
    r = respond(r.lead, msg("Laura"), configConPedidos, now);
    r = respond(r.lead, msg("retiro en el local"), configConPedidos, now);
    r = respond(r.lead, msg("el viernes"), configConPedidos, now);
    r = respond(r.lead, msg("sí"), configConPedidos, now);
    expect(r.lead.stage).toBe("datos_completos");

    const { lead, messages } = respond(r.lead, msg("uñas"), configConPedidos, now);
    expect(lead.entrega).toBeUndefined();
    expect(lead.stage).toBe("esperando_entrega");
    expect(messages[0].options).toEqual(["Retirar en el local", "Comer aquí"]);
  });
});

describe("respond — comando de reinicio", () => {
  it("'cancelar' en cualquier etapa arranca de cero, conservando el mismo lead", () => {
    let r = respond(null, msg("uñas"), config, now);
    r = respond(r.lead, msg("Carlos"), config, now);
    r = respond(r.lead, msg("hoy"), config, now);
    const idOriginal = r.lead.id;
    expect(r.lead.stage).toBe("esperando_confirmacion");

    r = respond(r.lead, msg("cancelar"), config, now);
    expect(r.lead.id).toBe(idOriginal); // mismo lead, no uno nuevo
    expect(r.lead.stage).toBe("menu_enviado");
    expect(r.lead.state).toBe("nuevo");
    expect(r.lead.name).toBeUndefined();
    expect(r.lead.serviceId).toBeUndefined();
    expect(r.lead.tentativeDate).toBeUndefined();
    expect(r.messages[0].options).toEqual(["Limpieza facial", "Uñas"]);
  });

  it("después de reiniciar, el flujo se puede recorrer de nuevo desde cero", () => {
    let r = respond(null, msg("uñas"), config, now);
    r = respond(r.lead, msg("Carlos"), config, now);
    r = respond(r.lead, msg("hoy"), config, now);
    r = respond(r.lead, msg("cancelar"), config, now);

    r = respond(r.lead, msg("limpieza facial"), config, now);
    expect(r.lead.serviceId).toBe("limpieza-facial");
    expect(r.lead.stage).toBe("esperando_nombre");
  });

  it("un lead nuevo que escribe 'cancelar' no dispara el reinicio (no hay nada que reiniciar)", () => {
    // Sin lead previo, el reinicio no aplica (guardia `existing &&`): se
    // procesa como cualquier primer mensaje, que siempre muestra el menú de
    // bienvenida (mismo comportamiento que "Hola" como primer contacto).
    const r = respond(null, msg("cancelar"), config, now);
    expect(r.lead.stage).toBe("menu_enviado");
    expect(r.messages[0].options).toEqual(["Limpieza facial", "Uñas"]);
  });
});

describe("respond — ítem sin duración (T-21)", () => {
  const tienda: BusinessConfig = {
    ...config,
    catalogo: { modoPorDefecto: "pedido", etiqueta: { singular: "Producto", plural: "Productos" } },
    services: [
      {
        id: "harina-pan",
        name: "Harina 1 Kg",
        description: "Harina pan tradicional",
        price: 5000,
        keywords: ["harina"],
      },
    ],
  };

  it("la variable {{duracion}} queda vacía en vez de decir 'undefined minutos'", () => {
    const { messages } = respond(null, msg("harina"), tienda, now);
    expect(messages[0].text).toContain("Harina 1 Kg");
    expect(messages[0].text).not.toContain("undefined");
    expect(messages[0].text).not.toContain("NaN");
  });

  it("un servicio CON duración la sigue mostrando igual que siempre", () => {
    const { messages } = respond(null, msg("limpieza facial"), config, now);
    expect(messages[0].text).toContain("60 minutos");
  });
});

describe("respond — flujo de pedido (T-21)", () => {
  const tienda: BusinessConfig = {
    ...config,
    slug: "tienda",
    name: "Tienda Test",
    catalogo: { modoPorDefecto: "pedido", etiqueta: { singular: "Producto", plural: "Productos" } },
    services: [
      {
        id: "harina",
        name: "Harina 1 Kg",
        description: "Harina pan tradicional",
        price: 5000,
        keywords: ["harina"],
      },
      {
        id: "aceite",
        name: "Aceite 1 Lt",
        description: "Aceite vegetal",
        price: 12000,
        keywords: ["aceite"],
      },
    ],
  };

  it("recorrido completo: dos productos distintos, total correcto, y queda en revisión al confirmar", () => {
    let r = respond(null, msg("harina"), tienda, now);
    expect(r.lead.stage).toBe("esperando_nombre");
    expect(r.messages[0].text).toContain("Harina 1 Kg");

    r = respond(r.lead, msg("Laura"), tienda, now);
    // No pregunta fecha ni modalidad de entrega: pasa directo a la cantidad.
    expect(r.lead.stage).toBe("esperando_cantidad");
    expect(r.lead.tentativeDate).toBeUndefined();
    expect(r.messages[0].text).not.toMatch(/fecha|agend/i);

    r = respond(r.lead, msg("2"), tienda, now);
    expect(r.lead.stage).toBe("carrito_abierto");
    expect(r.lead.items).toEqual([{ serviceId: "harina", cantidad: 2 }]);
    expect(r.messages[0].text).toContain("2x Harina 1 Kg");
    expect(r.messages[0].options).toContain("Aceite 1 Lt");
    expect(r.messages[0].options).toContain("No, eso es todo");

    r = respond(r.lead, msg("aceite"), tienda, now);
    expect(r.lead.stage).toBe("esperando_cantidad");
    expect(r.lead.serviceId).toBe("aceite");

    r = respond(r.lead, msg("una"), tienda, now);
    expect(r.lead.stage).toBe("carrito_abierto");
    expect(r.lead.items).toEqual([
      { serviceId: "harina", cantidad: 2 },
      { serviceId: "aceite", cantidad: 1 },
    ]);
    expect(r.messages[0].text).toContain("2x Harina 1 Kg");
    expect(r.messages[0].text).toContain("1x Aceite 1 Lt");

    r = respond(r.lead, msg("no, eso es todo"), tienda, now);
    expect(r.lead.stage).toBe("esperando_confirmacion");
    expect(r.messages[0].text).toContain("Total");
    expect(r.messages[0].options).toEqual(["Sí, confirmar", "Agregar más"]);

    // T-21/PR5: confirmar el pedido NO lo cierra directo — queda en revisión
    // hasta que la dueña responda por WhatsApp (eso es `handleOwnerApproval`
    // en `handle.ts`, fuera del motor puro).
    r = respond(r.lead, msg("sí"), tienda, now);
    expect(r.lead.state).toBe("interesado"); // todavía NO "pagado"
    expect(r.lead.stage).toBe("esperando_aprobacion");
    expect(r.messages[0].text).toContain("Total");
    expect(r.messages[0].text).toContain("Laura");
    expect(r.messages[0].text).toContain("revisión");
  });

  it("mientras espera la aprobación de la dueña, cualquier mensaje repite que sigue en revisión", () => {
    let r = respond(null, msg("harina"), tienda, now);
    r = respond(r.lead, msg("Laura"), tienda, now);
    r = respond(r.lead, msg("2"), tienda, now);
    r = respond(r.lead, msg("no, eso es todo"), tienda, now);
    r = respond(r.lead, msg("sí"), tienda, now);
    expect(r.lead.stage).toBe("esperando_aprobacion");

    const { lead, messages } = respond(r.lead, msg("hola, ¿cómo va?"), tienda, now);
    expect(lead.stage).toBe("esperando_aprobacion"); // no se mueve
    expect(messages[0].text).toContain("revisión");
  });

  it("no confirmar el pedido vuelve al carrito en vez de pedir una fecha", () => {
    let r = respond(null, msg("harina"), tienda, now);
    r = respond(r.lead, msg("Laura"), tienda, now);
    r = respond(r.lead, msg("2"), tienda, now);
    r = respond(r.lead, msg("no, eso es todo"), tienda, now);
    expect(r.lead.stage).toBe("esperando_confirmacion");

    r = respond(r.lead, msg("mejor no"), tienda, now);
    expect(r.lead.stage).toBe("carrito_abierto");
    expect(r.lead.items).toEqual([{ serviceId: "harina", cantidad: 2 }]); // no se perdió lo cargado
    expect(r.lead.state).not.toBe("pagado");
  });

  it("una cantidad no reconocible re-pregunta en vez de guardar cualquier cosa", () => {
    let r = respond(null, msg("harina"), tienda, now);
    r = respond(r.lead, msg("Laura"), tienda, now);
    r = respond(r.lead, msg("no sé cuántas"), tienda, now);
    expect(r.lead.stage).toBe("esperando_cantidad");
    expect(r.lead.items).toBeUndefined();
    expect(r.unrecognized).toBe(true);
  });

  /**
   * T-21/PR5: `respond()` (motor puro) ya NO es quien confirma un pedido —
   * eso lo hace `handleOwnerApproval` en `handle.ts` cuando la dueña acepta.
   * Estos dos tests siguen viviendo acá porque el bloque `datos_completos`
   * de `respond()` sigue siendo la RED de seguridad si por algún motivo un
   * pedido llega a `datos_completos`/"pagado" sin pasar por `handle.ts`
   * (`cerrarPedidoFinalizado` debería interceptarlo antes, pero el motor no
   * depende de eso) — por eso el lead post-aprobación se arma a mano, no
   * recorriendo `respond()` de punta a punta.
   */
  function leadPedidoConfirmado(): Lead {
    let r = respond(null, msg("harina"), tienda, now);
    r = respond(r.lead, msg("Laura"), tienda, now);
    r = respond(r.lead, msg("2"), tienda, now);
    r = respond(r.lead, msg("no"), tienda, now);
    r = respond(r.lead, msg("sí"), tienda, now);
    expect(r.lead.stage).toBe("esperando_aprobacion");
    return { ...r.lead, state: "pagado", stage: "datos_completos", confirmedAt: now.toISOString() };
  }

  it("recordatorio de pedido vigente tras confirmar: usa pedidoVigente, no citaVigente", () => {
    const confirmado = leadPedidoConfirmado();

    const { lead, messages } = respond(confirmado, msg("gracias!"), tienda, now);
    expect(lead.stage).toBe("datos_completos");
    expect(messages[0].text).toContain("pedido confirmado");
    expect(messages[0].text).not.toMatch(/agendado|turno|cita/i);
  });

  it("pedir de nuevo tras un pedido confirmado arranca un pedido NUEVO (limpia el carrito viejo)", () => {
    const confirmado = leadPedidoConfirmado();

    const { lead } = respond(confirmado, msg("aceite"), tienda, now);
    expect(lead.serviceId).toBe("aceite");
    expect(lead.items).toBeUndefined(); // el carrito viejo (2 harinas, ya pagado) no se arrastra
    expect(lead.stage).toBe("esperando_cantidad");
  });

  const taller: BusinessConfig = {
    ...config,
    slug: "taller",
    name: "Taller Mecánico Test",
    catalogo: { modoPorDefecto: "pedido", etiqueta: { singular: "Ítem", plural: "Ítems" } },
    services: [
      {
        id: "cambio-aceite",
        name: "Cambio de aceite",
        description: "Cambio de aceite y filtro",
        price: 80000,
        durationMinutes: 30,
        reservable: true,
        keywords: ["cambio de aceite"],
      },
      {
        id: "filtro-aceite",
        name: "Filtro de aceite",
        description: "Repuesto filtro de aceite",
        price: 25000,
        keywords: ["filtro"],
      },
    ],
  };

  it("taller mecánico: el service reservable agenda fecha, el repuesto pide cantidad — mismo negocio", () => {
    let cita = respond(null, msg("cambio de aceite"), taller, now);
    cita = respond(cita.lead, msg("Carlos"), taller, now);
    expect(cita.lead.stage).toBe("esperando_fecha");

    let pedido = respond(null, msg("filtro de aceite"), taller, now);
    pedido = respond(pedido.lead, msg("Carlos"), taller, now);
    expect(pedido.lead.stage).toBe("esperando_cantidad");
  });
});
