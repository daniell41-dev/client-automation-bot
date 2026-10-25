import { describe, expect, it } from "vitest";
import { inventaDatosDePago, runAgentTurn } from "@/core/ai/agent";
import type { AgentResponse } from "@/core/ai/agent-schema";
import type { ILLMProvider } from "@/core/ai/provider";
import type { BusinessConfig, IncomingMessage, Lead, PersonaConfig } from "@/core/types";

const config: BusinessConfig = {
  slug: "estetica-bella",
  name: "Estética Bella",
  currency: "COP",
  services: [
    {
      id: "limpieza-facial",
      name: "Limpieza facial",
      description: "Limpieza profunda",
      price: 120000,
      durationMinutes: 60,
    },
    {
      id: "unas",
      name: "Uñas",
      description: "Manicure semipermanente",
      price: 60000,
      durationMinutes: 45,
    },
    {
      id: "apagado",
      name: "Servicio apagado",
      description: "No se ofrece",
      price: 1000,
      durationMinutes: 30,
      disponible: false,
    },
  ],
  messages: {
    welcome: "¿Qué servicio?",
    askName: "¿Nombre?",
    askDate: "¿Fecha?",
    askConfirm: "¿Confirmas {{servicio}} para {{fecha}}?",
    serviceInfo: "{{servicio}} {{precio}}",
    captured: "Listo {{nombre}}",
    fallback: "no entendí",
  },
  followUps: [],
};

const persona: PersonaConfig = {
  name: "Isabella",
  tone: "cálida",
  language: "español colombiano",
};

function msg(text: string): IncomingMessage {
  return {
    channel: "mock",
    businessSlug: "estetica-bella",
    from: "57300000000",
    text,
    timestamp: "2026-06-21T10:00:00.000Z",
  };
}

const now = new Date("2026-06-21T10:00:00.000Z");

/** LLM falso: runAgent devuelve las respuestas dadas, una por llamada (o la misma si es una sola). */
function fakeAgentLLM(responses: AgentResponse | AgentResponse[]): ILLMProvider {
  const queue = Array.isArray(responses) ? [...responses] : null;
  const single = Array.isArray(responses) ? null : responses;
  return {
    async enhance(ctx) {
      return ctx.draftResponse;
    },
    async extractDateTime() {
      return null;
    },
    async interpret() {
      return null;
    },
    async runAgent(): Promise<AgentResponse | null> {
      if (single) return single;
      return queue!.shift() ?? null;
    },
  };
}

function throwingLLM(): ILLMProvider {
  return {
    async enhance(ctx) {
      return ctx.draftResponse;
    },
    async extractDateTime() {
      return null;
    },
    async interpret() {
      return null;
    },
    async runAgent(): Promise<AgentResponse | null> {
      throw new Error("proveedor caído");
    },
  };
}

describe("runAgentTurn — aplica acciones validadas", () => {
  it("elegir_servicio + guardar_nombre + guardar_fecha + confirmar en un solo turno agenda la cita", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¡Listo Carlos! Tu cita quedó agendada para mañana 💜",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "unas" },
        { tipo: "guardar_nombre", nombre: "Carlos" },
        { tipo: "guardar_fecha", fecha: "mañana" },
        { tipo: "confirmar" },
      ],
    });

    const result = await runAgentTurn(
      null,
      msg("Hola, quiero uñas, soy Carlos, para mañana"),
      config,
      llm,
      persona,
      [],
      now,
    );

    expect(result).not.toBeNull();
    expect(result!.lead.serviceId).toBe("unas");
    expect(result!.lead.name).toBe("Carlos");
    expect(result!.lead.tentativeDate).toBe("mañana");
    expect(result!.lead.stage).toBe("datos_completos");
    expect(result!.lead.state).toBe("agendado");
    expect(result!.messages[0].text).toBe("¡Listo Carlos! Tu cita quedó agendada para mañana 💜");
  });

  it("construye el flujo en varios turnos, derivando la etapa de los datos que ya tiene", async () => {
    let lead: Lead | null = null;

    const r1 = await runAgentTurn(
      lead,
      msg("Hola, quiero uñas"),
      config,
      fakeAgentLLM({
        respuesta: "¡Con gusto! ¿Cuál es tu nombre?",
        acciones: [{ tipo: "elegir_servicio", servicioId: "unas" }],
      }),
      persona,
      [],
      now,
    );
    lead = r1!.lead;
    expect(lead.stage).toBe("esperando_nombre");

    const r2 = await runAgentTurn(
      lead,
      msg("Carlos"),
      config,
      fakeAgentLLM({
        respuesta: "Genial Carlos, ¿para qué día?",
        acciones: [{ tipo: "guardar_nombre", nombre: "Carlos" }],
      }),
      persona,
      [],
      now,
    );
    lead = r2!.lead;
    expect(lead.stage).toBe("esperando_fecha");

    const r3 = await runAgentTurn(
      lead,
      msg("mañana"),
      config,
      fakeAgentLLM({
        respuesta: "¿Confirmamos para mañana?",
        acciones: [{ tipo: "guardar_fecha", fecha: "mañana" }],
      }),
      persona,
      [],
      now,
    );
    lead = r3!.lead;
    expect(lead.stage).toBe("esperando_confirmacion");

    const r4 = await runAgentTurn(
      lead,
      msg("sí, dale"),
      config,
      fakeAgentLLM({ respuesta: "¡Listo!", acciones: [{ tipo: "confirmar" }] }),
      persona,
      [],
      now,
    );
    expect(r4!.lead.stage).toBe("datos_completos");
    expect(r4!.lead.state).toBe("agendado");
  });
});

describe("runAgentTurn — guardrails: nunca aplica una acción sin validar", () => {
  it("ignora elegir_servicio con un id que no existe en el catálogo", async () => {
    const llm = fakeAgentLLM({
      respuesta: "hola",
      acciones: [{ tipo: "elegir_servicio", servicioId: "servicio-inventado" }],
    });
    const result = await runAgentTurn(null, msg("quiero algo raro"), config, llm, persona, [], now);
    expect(result!.lead.serviceId).toBeUndefined();
  });

  it("ignora elegir_servicio de un servicio marcado disponible: false", async () => {
    const llm = fakeAgentLLM({
      respuesta: "hola",
      acciones: [{ tipo: "elegir_servicio", servicioId: "apagado" }],
    });
    const result = await runAgentTurn(null, msg("quiero el apagado"), config, llm, persona, [], now);
    expect(result!.lead.serviceId).toBeUndefined();
  });

  it("ignora guardar_nombre si el texto es un saludo (la IA se equivocó)", async () => {
    const llm = fakeAgentLLM({
      respuesta: "hola",
      acciones: [{ tipo: "guardar_nombre", nombre: "Hola buenas" }],
    });
    const result = await runAgentTurn(null, msg("Hola buenas"), config, llm, persona, [], now);
    expect(result!.lead.name).toBeUndefined();
  });

  it("ignora guardar_nombre si el texto es un pedido de menú", async () => {
    const llm = fakeAgentLLM({
      respuesta: "hola",
      acciones: [{ tipo: "guardar_nombre", nombre: "me repites las opciones" }],
    });
    const result = await runAgentTurn(null, msg("me repites las opciones"), config, llm, persona, [], now);
    expect(result!.lead.name).toBeUndefined();
  });

  it("ignora guardar_fecha si el texto no parece una fecha real", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¿qué día te gustaría?",
      acciones: [{ tipo: "guardar_fecha", fecha: "no se todavia" }],
    });
    const result = await runAgentTurn(null, msg("no se todavia"), config, llm, persona, [], now);
    expect(result!.lead.tentativeDate).toBeUndefined();
  });

  it("acepta guardar_fecha y la limpia igual que el motor determinista", async () => {
    const llm = fakeAgentLLM({
      respuesta: "ok",
      acciones: [{ tipo: "guardar_fecha", fecha: "Puede ser mañana en la tarde" }],
    });
    const result = await runAgentTurn(null, msg("Puede ser mañana en la tarde"), config, llm, persona, [], now);
    expect(result!.lead.tentativeDate).toBe("mañana en la tarde");
  });

  it("NO confirma si faltan datos, aunque la IA declare 'confirmar'", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¿cuál es tu nombre?",
      acciones: [{ tipo: "elegir_servicio", servicioId: "unas" }, { tipo: "confirmar" }],
    });
    const result = await runAgentTurn(null, msg("quiero uñas, confirmo"), config, llm, persona, [], now);
    expect(result!.lead.stage).not.toBe("datos_completos");
    expect(result!.lead.state).not.toBe("agendado");
  });
});

describe("runAgentTurn — modalidad de pedidos", () => {
  const configConPedidos: BusinessConfig = {
    ...config,
    pedidos: {
      enabled: true,
      pregunta: "¿Retirás o comés acá?",
      opciones: ["Retirar en el local", "Comer aquí"],
    },
  };

  it("acepta guardar_modalidad con el texto EXACTO de una opción", async () => {
    const llm = fakeAgentLLM({
      respuesta: "ok",
      acciones: [{ tipo: "guardar_modalidad", modalidad: "Retirar en el local" }],
    });
    const result = await runAgentTurn(null, msg("retiro"), configConPedidos, llm, persona, [], now);
    expect(result!.lead.entrega).toBe("Retirar en el local");
  });

  it("normaliza una modalidad reconocible aunque no sea el texto exacto", async () => {
    const llm = fakeAgentLLM({
      respuesta: "ok",
      acciones: [{ tipo: "guardar_modalidad", modalidad: "prefiero retirar" }],
    });
    const result = await runAgentTurn(null, msg("prefiero retirar"), configConPedidos, llm, persona, [], now);
    expect(result!.lead.entrega).toBe("Retirar en el local");
  });

  it("ignora una modalidad que no coincide con ninguna opción", async () => {
    const llm = fakeAgentLLM({
      respuesta: "ok",
      acciones: [{ tipo: "guardar_modalidad", modalidad: "por correo postal" }],
    });
    const result = await runAgentTurn(null, msg("por correo"), configConPedidos, llm, persona, [], now);
    expect(result!.lead.entrega).toBeUndefined();
  });

  it("NO confirma sin modalidad cuando el negocio la requiere", async () => {
    const llm = fakeAgentLLM({
      respuesta: "ok",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "unas" },
        { tipo: "guardar_nombre", nombre: "Carlos" },
        { tipo: "guardar_fecha", fecha: "hoy" },
        { tipo: "confirmar" },
      ],
    });
    const result = await runAgentTurn(null, msg("todo junto"), configConPedidos, llm, persona, [], now);
    expect(result!.lead.stage).not.toBe("datos_completos");
  });
});

describe("runAgentTurn — fuera de contexto (2 redirige, 3 cierra)", () => {
  function offTopicLead(count: number): Lead {
    return {
      id: "lead-1",
      businessSlug: "estetica-bella",
      channel: "mock",
      contact: "57300000000",
      name: "Carlos",
      state: "interesado",
      stage: "menu_enviado",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastInboundAt: now.toISOString(),
      followUpsSent: [],
      offTopicCount: count,
    };
  }

  it("la primera vez redirige con la respuesta de la IA y cuenta 1", async () => {
    const llm = fakeAgentLLM({
      respuesta: "Jaja, no tengo idea 😅 ¿seguimos con tu cita?",
      acciones: [{ tipo: "fuera_de_contexto" }],
    });
    const result = await runAgentTurn(offTopicLead(0), msg("¿quién ganó el mundial?"), config, llm, persona, [], now);
    expect(result!.lead.offTopicCount).toBe(1);
    expect(result!.lead.name).toBe("Carlos"); // no se pierde nada
    expect(result!.messages[0].text).toContain("seguimos con tu cita");
  });

  it("la segunda vez sigue redirigiendo (cuenta 2, no cierra)", async () => {
    const llm = fakeAgentLLM({ respuesta: "Volvamos a lo tuyo 😊", acciones: [{ tipo: "fuera_de_contexto" }] });
    const result = await runAgentTurn(offTopicLead(1), msg("otra vez algo random"), config, llm, persona, [], now);
    expect(result!.lead.offTopicCount).toBe(2);
    expect(result!.lead.name).toBe("Carlos");
  });

  it("la tercera vez cierra la charla con amabilidad y reinicia el lead", async () => {
    const llm = fakeAgentLLM({ respuesta: "esto no debería usarse", acciones: [{ tipo: "fuera_de_contexto" }] });
    const result = await runAgentTurn(offTopicLead(2), msg("tercera vez random"), config, llm, persona, [], now);

    expect(result!.lead.offTopicCount).toBe(0);
    expect(result!.lead.state).toBe("nuevo");
    expect(result!.lead.stage).toBe("inicio");
    expect(result!.lead.name).toBeUndefined();
    expect(result!.lead.serviceId).toBeUndefined();
    // El mensaje de cierre reemplaza lo que haya dicho la IA, e incluye el nombre previo.
    expect(result!.messages[0].text).toContain("Carlos");
    expect(result!.messages[0].text).not.toBe("esto no debería usarse");
  });

  it("volver al tema resetea el contador a 0", async () => {
    const llm = fakeAgentLLM({ respuesta: "ok", acciones: [{ tipo: "guardar_fecha", fecha: "mañana" }] });
    const result = await runAgentTurn(offTopicLead(2), msg("mañana"), config, llm, persona, [], now);
    expect(result!.lead.offTopicCount).toBe(0);
  });

  it("una vez ya confirmado, irse del tema NO borra la cita", async () => {
    const leadConfirmado: Lead = {
      ...offTopicLead(0),
      serviceId: "unas",
      tentativeDate: "mañana",
      stage: "datos_completos",
      state: "agendado",
    };
    const llm = fakeAgentLLM({ respuesta: "jaja buena esa", acciones: [{ tipo: "fuera_de_contexto" }] });
    const result = await runAgentTurn(leadConfirmado, msg("che, ¿y el clima como esta?"), config, llm, persona, [], now);

    expect(result!.lead.stage).toBe("datos_completos");
    expect(result!.lead.serviceId).toBe("unas");
    expect(result!.lead.tentativeDate).toBe("mañana");
  });
});

describe("runAgentTurn — nueva reserva tras una ya confirmada", () => {
  it("conserva el nombre pero limpia fecha/modalidad al elegir un servicio nuevo", async () => {
    const leadConfirmado: Lead = {
      id: "lead-1",
      businessSlug: "estetica-bella",
      channel: "mock",
      contact: "57300000000",
      name: "Carlos",
      serviceId: "unas",
      tentativeDate: "mañana",
      state: "agendado",
      stage: "datos_completos",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastInboundAt: now.toISOString(),
      followUpsSent: [],
    };
    const llm = fakeAgentLLM({
      respuesta: "¡Dale! ¿Para qué día la limpieza facial?",
      acciones: [{ tipo: "elegir_servicio", servicioId: "limpieza-facial" }],
    });
    const result = await runAgentTurn(
      leadConfirmado,
      msg("también quiero una limpieza facial"),
      config,
      llm,
      persona,
      [],
      now,
    );

    expect(result!.lead.serviceId).toBe("limpieza-facial");
    expect(result!.lead.name).toBe("Carlos");
    expect(result!.lead.tentativeDate).toBeUndefined();
    expect(result!.lead.stage).toBe("esperando_fecha");
  });
});

describe("runAgentTurn — fallback (cuando el agente no puede procesar el turno)", () => {
  it("devuelve null si el proveedor lanza", async () => {
    const result = await runAgentTurn(null, msg("Hola"), config, throwingLLM(), persona, [], now);
    expect(result).toBeNull();
  });

  it("devuelve null si el proveedor no devuelve un JSON válido (runAgent → null)", async () => {
    const llmSinRespuesta: ILLMProvider = {
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent() {
        return null;
      },
    };
    const result = await runAgentTurn(null, msg("Hola"), config, llmSinRespuesta, persona, [], now);
    expect(result).toBeNull();
  });
});

describe("runAgentTurn — corregir datos viejos / reiniciar", () => {
  const leadConDatosViejos: Lead = {
    id: "lead-1",
    businessSlug: "estetica-bella",
    channel: "mock",
    contact: "57300000000",
    name: "Carlos",
    serviceId: "unas",
    tentativeDate: "mañana",
    state: "interesado",
    stage: "esperando_confirmacion",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastInboundAt: now.toISOString(),
    followUpsSent: [],
  };

  it("la acción 'reiniciar' borra los datos que la IA detectó como equivocados", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¡Tenés razón, perdón! Empecemos de nuevo 😊 ¿Qué servicio te interesa?",
      acciones: [{ tipo: "reiniciar" }],
    });
    const result = await runAgentTurn(
      leadConDatosViejos,
      msg("pero yo no he pedido nada"),
      config,
      llm,
      persona,
      [],
      now,
    );

    expect(result!.lead.name).toBeUndefined();
    expect(result!.lead.serviceId).toBeUndefined();
    expect(result!.lead.tentativeDate).toBeUndefined();
    expect(result!.lead.state).toBe("nuevo");
  });

  it("'reiniciar' + 'elegir_servicio' en el mismo turno: el servicio nuevo sobrevive", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¡Listo, arrancamos de nuevo con una depilación! ¿Para qué día?",
      acciones: [{ tipo: "reiniciar" }, { tipo: "elegir_servicio", servicioId: "limpieza-facial" }],
    });
    const result = await runAgentTurn(
      leadConDatosViejos,
      msg("no, olvidá eso, quiero una limpieza facial"),
      config,
      llm,
      persona,
      [],
      now,
    );

    expect(result!.lead.serviceId).toBe("limpieza-facial");
    expect(result!.lead.name).toBeUndefined(); // lo viejo sí se borró
    expect(result!.lead.tentativeDate).toBeUndefined();
  });

  it("'cancelar' limpia ANTES de llamar a la IA (el agente ve el estado en blanco)", async () => {
    let inputVisto: { name?: string; serviceId?: string; yaConfirmado: boolean } | null = null;
    const llm: ILLMProvider = {
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent(input) {
        inputVisto = input.lead;
        return { respuesta: "¡Dale! Empecemos de nuevo 😊", acciones: [] };
      },
    };

    const result = await runAgentTurn(leadConDatosViejos, msg("cancelar"), config, llm, persona, [], now);

    expect(inputVisto!.name).toBeUndefined();
    expect(inputVisto!.serviceId).toBeUndefined();
    expect(result!.lead.name).toBeUndefined();
    expect(result!.lead.serviceId).toBeUndefined();
  });
});

describe("runAgentTurn — la IA sabe si la cita ya está confirmada", () => {
  it("le pasa yaConfirmado: true cuando el lead ya está en datos_completos", async () => {
    let yaConfirmadoVisto: boolean | null = null;
    const llm: ILLMProvider = {
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent(input) {
        yaConfirmadoVisto = input.lead.yaConfirmado;
        return { respuesta: "¡Gracias a vos, Carlos! Te esperamos 💜", acciones: [] };
      },
    };

    const leadConfirmado: Lead = {
      id: "lead-1",
      businessSlug: "estetica-bella",
      channel: "mock",
      contact: "57300000000",
      name: "Carlos",
      serviceId: "unas",
      tentativeDate: "mañana",
      state: "agendado",
      stage: "datos_completos",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastInboundAt: now.toISOString(),
      followUpsSent: [],
    };

    await runAgentTurn(leadConfirmado, msg("muchas gracias"), config, llm, persona, [], now);
    expect(yaConfirmadoVisto).toBe(true);
  });

  it("le pasa yaConfirmado: false mientras la cita no esté cerrada", async () => {
    let yaConfirmadoVisto: boolean | null = null;
    const llm: ILLMProvider = {
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent(input) {
        yaConfirmadoVisto = input.lead.yaConfirmado;
        return { respuesta: "¿Para qué día?", acciones: [] };
      },
    };

    await runAgentTurn(null, msg("Hola"), config, llm, persona, [], now);
    expect(yaConfirmadoVisto).toBe(false);
  });
});

describe("runAgentTurn — flujo de pedido en modo agente (T-21)", () => {
  const tienda: BusinessConfig = {
    ...config,
    slug: "tienda",
    name: "Tienda Test",
    catalogo: { modoPorDefecto: "pedido", etiqueta: { singular: "Producto", plural: "Productos" } },
    services: [
      { id: "harina", name: "Harina 1 Kg", description: "Harina pan", price: 5000 },
      { id: "aceite", name: "Aceite 1 Lt", description: "Aceite vegetal", price: 12000 },
      {
        id: "asesoria",
        name: "Asesoría personalizada",
        description: "Visita en el local",
        price: 0,
        durationMinutes: 20,
        reservable: true,
      },
    ],
  };

  it("guardar_cantidad + confirmar con nombre y carrito deja el pedido 'esperando_aprobacion' (no lo cierra directo)", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¡Gracias Laura! Tu pedido quedó en revisión.",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "harina" },
        { tipo: "guardar_nombre", nombre: "Laura" },
        { tipo: "guardar_cantidad", servicioId: "harina", cantidad: 2 },
        { tipo: "confirmar" },
      ],
    });
    const result = await runAgentTurn(
      null,
      msg("quiero 2 harinas, soy Laura"),
      tienda,
      llm,
      persona,
      [],
      now,
    );

    expect(result!.lead.items).toEqual([{ serviceId: "harina", cantidad: 2 }]);
    // T-48: el primer "confirmar" muestra el resumen con el total — el
    // cliente todavía no lo vio — y reemplaza el texto de la IA, que decía
    // algo que no pasó ("quedó en revisión").
    expect(result!.lead.stage).toBe("esperando_confirmacion");
    expect(result!.messages[0].text).toContain("2x Harina 1 Kg");
    expect(result!.messages[0].text).toContain("Total:");
    expect(result!.messages[0].text).not.toContain("en revisión");

    // Con el "sí" al resumen recién pasa a la dueña. T-21/PR5: NO pasa a
    // "pagado"/"datos_completos" directo — el estado sigue "interesado" hasta
    // que la dueña acepte o rechace (eso lo maneja `handle.ts`).
    const llmSi = fakeAgentLLM({ respuesta: "¡Listo! Quedó en revisión.", acciones: [] });
    const confirmado = await runAgentTurn(result!.lead, msg("sí"), tienda, llmSi, persona, [], now);
    expect(confirmado!.lead.stage).toBe("esperando_aprobacion");
    expect(confirmado!.lead.state).toBe("interesado");
    expect(confirmado!.lead.tentativeDate).toBeUndefined();
  });

  it("una vez esperando_aprobacion, un mensaje nuevo NO re-deriva el stage (sticky)", async () => {
    const leadEsperandoAprobacion: Lead = {
      id: "lead-1",
      businessSlug: "tienda",
      channel: "mock",
      contact: "57300000000",
      name: "Laura",
      serviceId: "harina",
      items: [{ serviceId: "harina", cantidad: 2 }],
      state: "interesado",
      stage: "esperando_aprobacion",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastInboundAt: now.toISOString(),
      followUpsSent: [],
    };
    const llm = fakeAgentLLM({ respuesta: "Sigue en revisión, en un momento te aviso 🙏", acciones: [] });
    const result = await runAgentTurn(leadEsperandoAprobacion, msg("¿ya está?"), tienda, llm, persona, [], now);

    expect(result!.lead.stage).toBe("esperando_aprobacion");
    expect(result!.lead.items).toEqual([{ serviceId: "harina", cantidad: 2 }]); // el carrito no se toca
  });

  it("acepta varios guardar_cantidad en el mismo turno (carrito con más de un producto)", async () => {
    const llm = fakeAgentLLM({
      respuesta: "Anotado: 2 harinas y 1 aceite.",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "harina" },
        { tipo: "guardar_nombre", nombre: "Laura" },
        { tipo: "guardar_cantidad", servicioId: "harina", cantidad: 2 },
        { tipo: "guardar_cantidad", servicioId: "aceite", cantidad: 1 },
      ],
    });
    const result = await runAgentTurn(
      null,
      msg("quiero 2 harinas y 1 aceite, soy Laura"),
      tienda,
      llm,
      persona,
      [],
      now,
    );

    expect(result!.lead.items).toEqual([
      { serviceId: "harina", cantidad: 2 },
      { serviceId: "aceite", cantidad: 1 },
    ]);
    // T-48: con nombre y carrito ya está listo para cerrar: el motor suma el
    // resumen con el total y pregunta, aunque la IA no lo haya hecho.
    expect(result!.lead.stage).toBe("esperando_confirmacion");
    expect(result!.messages[0].text).toContain("Anotado: 2 harinas y 1 aceite.");
    expect(result!.messages[0].text).toContain("Total:");
  });

  it("sin fecha (un pedido nunca la necesita), 'confirmar' NO se bloquea por falta de tentativeDate", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¡Gracias!",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "harina" },
        { tipo: "guardar_nombre", nombre: "Laura" },
        { tipo: "guardar_cantidad", servicioId: "harina", cantidad: 1 },
        { tipo: "confirmar" },
      ],
    });
    const result = await runAgentTurn(null, msg("una harina, soy Laura"), tienda, llm, persona, [], now);
    // Sin `tentativeDate` igual llega al resumen y, con el sí, a
    // "esperando_aprobacion" — `confirmar` no se bloquea por falta de fecha.
    expect(result!.lead.stage).toBe("esperando_confirmacion");
    const confirmado = await runAgentTurn(result!.lead, msg("sí"), tienda, fakeAgentLLM({ respuesta: "ok", acciones: [{ tipo: "confirmar" }] }), persona, [], now);
    expect(confirmado!.lead.stage).toBe("esperando_aprobacion");
  });

  it("T-48: si la IA quiere cerrar un pedido al que le falta algo, el bot pregunta lo que falta (no promete nada)", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¡Ya le pasamos tu pedido a la dueña!",
      acciones: [{ tipo: "elegir_servicio", servicioId: "harina" }, { tipo: "guardar_nombre", nombre: "Laura" }, { tipo: "confirmar" }],
    });
    // T-51: la harina entra al carrito con cantidad 1; lo que falta es la modalidad.
    const conModalidad: BusinessConfig = {
      ...tienda,
      pedidos: { enabled: true, pregunta: "¿Domicilio o recoger?", opciones: ["Domicilio", "Recoger en el local"] },
    };
    const result = await runAgentTurn(null, msg("harina, soy Laura"), conModalidad, llm, persona, [], now);
    expect(result!.lead.stage).not.toBe("esperando_aprobacion");
    expect(result!.messages[0].text).toBe("¿Domicilio o recoger?");
  });

  it("T-48: si el pedido cambia después del resumen, el sí no confirma: se muestra el resumen nuevo", async () => {
    const llm1 = fakeAgentLLM({
      respuesta: "Anotado.",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "harina" },
        { tipo: "guardar_nombre", nombre: "Laura" },
        { tipo: "guardar_cantidad", servicioId: "harina", cantidad: 1 },
      ],
    });
    const r1 = await runAgentTurn(null, msg("una harina, soy Laura"), tienda, llm1, persona, [], now);
    expect(r1!.lead.stage).toBe("esperando_confirmacion");

    const llm2 = fakeAgentLLM({
      respuesta: "Listo, agregado.",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "aceite", cantidad: 1 }, { tipo: "confirmar" }],
    });
    const r2 = await runAgentTurn(r1!.lead, msg("sí, y agregá un aceite"), tienda, llm2, persona, [], now);
    expect(r2!.lead.stage).toBe("esperando_confirmacion");
    expect(r2!.messages[0].text).toContain("1x Aceite 1 Lt");
  });

  it("ignora guardar_cantidad contra un ítem que no existe en el catálogo", async () => {
    const llm = fakeAgentLLM({
      respuesta: "hola",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "no-existe", cantidad: 3 }],
    });
    const result = await runAgentTurn(null, msg("quiero 3"), tienda, llm, persona, [], now);
    expect(result!.lead.items).toBeUndefined();
  });

  it("ignora guardar_cantidad contra un ítem de modo cita (no se vende, se agenda)", async () => {
    const llm = fakeAgentLLM({
      respuesta: "hola",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "asesoria", cantidad: 2 }],
    });
    const result = await runAgentTurn(null, msg("2 asesorías"), tienda, llm, persona, [], now);
    expect(result!.lead.items).toBeUndefined();
  });

  it("sin carrito, 'confirmar' NO cierra el pedido aunque la IA lo declare", async () => {
    const llm = fakeAgentLLM({
      respuesta: "¿Cuánto querés?",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "harina" },
        { tipo: "guardar_nombre", nombre: "Laura" },
        { tipo: "confirmar" },
      ],
    });
    const result = await runAgentTurn(null, msg("quiero harina, soy Laura"), tienda, llm, persona, [], now);
    expect(result!.lead.stage).not.toBe("datos_completos");
    expect(result!.lead.state).not.toBe("pagado");
  });

  it("pedir de nuevo tras un pedido confirmado limpia el carrito viejo (pedido nuevo, no un agregado)", async () => {
    const leadConfirmado: Lead = {
      id: "lead-1",
      businessSlug: "tienda",
      channel: "mock",
      contact: "57300000000",
      name: "Laura",
      serviceId: "harina",
      items: [{ serviceId: "harina", cantidad: 2 }],
      state: "pagado",
      stage: "datos_completos",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastInboundAt: now.toISOString(),
      followUpsSent: [],
    };
    const llm = fakeAgentLLM({
      respuesta: "¡Dale! ¿Cuánto aceite querés?",
      acciones: [{ tipo: "elegir_servicio", servicioId: "aceite" }],
    });
    const result = await runAgentTurn(leadConfirmado, msg("también quiero aceite"), tienda, llm, persona, [], now);

    expect(result!.lead.serviceId).toBe("aceite");
    expect(result!.lead.items).toBeUndefined(); // el carrito viejo (ya pagado) no se arrastra
    expect(result!.lead.stage).toBe("esperando_cantidad");
  });

  it("le pasa a la IA el catálogo con el modo resuelto y el carrito ya cargado", async () => {
    let serviciosVistos: { id: string; modo?: string }[] = [];
    let itemsVistos: unknown;
    const llm: ILLMProvider = {
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent(input) {
        serviciosVistos = input.services;
        itemsVistos = input.lead.items;
        return { respuesta: "hola", acciones: [] };
      },
    };
    const leadConCarrito: Lead = {
      id: "lead-1",
      businessSlug: "tienda",
      channel: "mock",
      contact: "57300000000",
      name: "Laura",
      serviceId: "harina",
      items: [{ serviceId: "harina", cantidad: 2 }],
      state: "interesado",
      stage: "carrito_abierto",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastInboundAt: now.toISOString(),
      followUpsSent: [],
    };

    await runAgentTurn(leadConCarrito, msg("también aceite"), tienda, llm, persona, [], now);

    expect(serviciosVistos.find((s) => s.id === "harina")?.modo).toBe("pedido");
    expect(serviciosVistos.find((s) => s.id === "asesoria")?.modo).toBe("cita");
    expect(itemsVistos).toEqual([{ servicioId: "harina", nombre: "Harina 1 Kg", cantidad: 2 }]);
  });
});

describe("runAgentTurn — le pasa a la IA las reglas rápidas del negocio", () => {
  it("propaga config.ai.reglas en el input del agente", async () => {
    let reglasVistas: unknown = "sin-tocar";
    const configConReglas: BusinessConfig = {
      ...config,
      ai: {
        enabled: true,
        reglas: [{ keywords: ["horario"], respuesta: "Abrimos de 9 a 6." }],
      },
    };
    const llm: ILLMProvider = {
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent(input) {
        reglasVistas = input.reglas;
        return { respuesta: "Abrimos de 9 a 6.", acciones: [] };
      },
    };

    await runAgentTurn(null, msg("¿cuál es el horario?"), configConReglas, llm, persona, [], now);
    expect(reglasVistas).toEqual([{ keywords: ["horario"], respuesta: "Abrimos de 9 a 6." }]);
  });

  it("sin reglas configuradas, el input del agente trae 'reglas' undefined", async () => {
    let reglasVistas: unknown = "sin-tocar";
    const llm: ILLMProvider = {
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent(input) {
        reglasVistas = input.reglas;
        return { respuesta: "hola", acciones: [] };
      },
    };

    await runAgentTurn(null, msg("Hola"), config, llm, persona, [], now);
    expect(reglasVistas).toBeUndefined();
  });
});

describe("runAgentTurn — modalidad y dirección (T-50)", () => {
  const restaurante: BusinessConfig = {
    ...config,
    slug: "sabores",
    catalogo: { modoPorDefecto: "pedido", etiqueta: { singular: "Plato", plural: "Menú" } },
    services: [
      { id: "bandeja", name: "Bandeja paisa", description: "x", price: 28000 },
      { id: "limonada", name: "Limonada de coco", description: "x", price: 8000 },
    ],
    pedidos: { enabled: true, pregunta: "¿Domicilio o recoger?", opciones: ["Domicilio", "Recoger en el local"] },
  };
  const base = [
    { tipo: "elegir_servicio" as const, servicioId: "bandeja" },
    { tipo: "guardar_nombre" as const, nombre: "Oriana" },
    { tipo: "guardar_cantidad" as const, servicioId: "bandeja", cantidad: 1 },
  ];

  it("la dirección antes que la modalidad en el mismo turno no se pierde", async () => {
    const llm = fakeAgentLLM({
      respuesta: "Anotado.",
      acciones: [
        ...base,
        { tipo: "guardar_direccion", direccion: "Avenida 7 # 5-68" },
        { tipo: "guardar_modalidad", modalidad: "Domicilio" },
      ],
    });
    const r = await runAgentTurn(null, msg("una bandeja a domicilio, Avenida 7 # 5-68, soy Oriana"), restaurante, llm, persona, [], now);
    expect(r!.lead.entrega).toBe("Domicilio");
    expect(r!.lead.direccion).toBe("Avenida 7 # 5-68");
    expect(r!.lead.stage).toBe("esperando_confirmacion");
    expect(r!.messages[0].text).toContain("Total: $");
  });

  it("una dirección sin modalidad declarada implica domicilio", async () => {
    const llm = fakeAgentLLM({
      respuesta: "Anotado.",
      acciones: [...base, { tipo: "guardar_direccion", direccion: "Calle 10 # 5-20, San Luis" }],
    });
    const r = await runAgentTurn(null, msg("mandala a la Calle 10 # 5-20"), restaurante, llm, persona, [], now);
    expect(r!.lead.entrega).toBe("Domicilio");
    expect(r!.lead.direccion).toBe("Calle 10 # 5-20, San Luis");
  });

  it("si el cliente nombra la modalidad y la IA no la declara, se toma del mensaje", async () => {
    const llm = fakeAgentLLM({ respuesta: "¿A qué dirección?", acciones: base });
    const r = await runAgentTurn(null, msg("Domicilio por favor"), restaurante, llm, persona, [], now);
    expect(r!.lead.entrega).toBe("Domicilio");
  });
});

describe("runAgentTurn — cantidad por defecto y cuentas inventadas (T-51)", () => {
  const restaurante: BusinessConfig = {
    ...config,
    slug: "sabores",
    catalogo: { modoPorDefecto: "pedido", etiqueta: { singular: "Plato", plural: "Menú" } },
    services: [{ id: "bandeja", name: "Bandeja paisa", description: "x", price: 28000 }],
    pagos: {
      requiereComprobante: true,
      cuentas: [{ entidad: "Bancolombia", tipo: "ahorros", numero: "123-456789-01", titular: "Laura" }],
    },
  };

  it("elegir un plato sin cantidad lo pone en el carrito con la del mensaje (o 1)", async () => {
    const una = await runAgentTurn(
      null,
      msg("Dame una bandeja paisa por favor"),
      restaurante,
      fakeAgentLLM({ respuesta: "¡Excelente elección!", acciones: [{ tipo: "elegir_servicio", servicioId: "bandeja" }] }),
      persona,
      [],
      now,
    );
    expect(una!.lead.items).toEqual([{ serviceId: "bandeja", cantidad: 1 }]);

    const dos = await runAgentTurn(
      null,
      msg("quiero dos bandejas"),
      restaurante,
      fakeAgentLLM({ respuesta: "¡Dale!", acciones: [{ tipo: "elegir_servicio", servicioId: "bandeja" }] }),
      persona,
      [],
      now,
    );
    expect(dos!.lead.items).toEqual([{ serviceId: "bandeja", cantidad: 2 }]);
  });

  it("si la IA escribe un número de cuenta que no está configurado, su respuesta no sale", async () => {
    const r = await runAgentTurn(
      null,
      msg("¿a dónde pago?"),
      restaurante,
      fakeAgentLLM({ respuesta: "Transferí a Nequi al 312 345 6789 y mandame el comprobante", acciones: [] }),
      persona,
      [],
      now,
    );
    expect(r!.messages[0].text).not.toContain("312");
  });
});

describe("inventaDatosDePago (T-51)", () => {
  const conCuenta: BusinessConfig = {
    ...config,
    pagos: { cuentas: [{ entidad: "Nequi", tipo: "billetera", numero: "300 000 0000" }] },
  };

  it("un número cargado en la configuración está permitido, con o sin espacios", () => {
    expect(inventaDatosDePago("Nequi 3000000000", conCuenta)).toBe(false);
    expect(inventaDatosDePago("Nequi 300-000-0000", conCuenta)).toBe(false);
  });

  it("un número que no está cargado se detecta", () => {
    expect(inventaDatosDePago("Bancolombia al 3123456789", conCuenta)).toBe(true);
  });

  it("los precios, las direcciones y las cantidades no cuentan", () => {
    expect(inventaDatosDePago("Total: $1.250.000, Av 7 # 5-68, 2 bandejas", conCuenta)).toBe(false);
  });
});
