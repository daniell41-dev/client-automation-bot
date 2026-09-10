import { describe, expect, it } from "vitest";
import { runAgentTurn } from "@/core/ai/agent";
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
