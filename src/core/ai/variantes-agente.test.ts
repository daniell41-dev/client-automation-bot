/**
 * T-104: el agente con productos que vienen en tallas (mayorista de jeans).
 * Se simula la respuesta de la IA para probar lo que hace el MOTOR con ella:
 * valida la talla contra el catálogo, pregunta la que falta y la muestra en
 * el resumen.
 */

import { describe, expect, it } from "vitest";
import { runAgentTurn } from "@/core/ai/agent";
import type { AgentResponse } from "@/core/ai/agent-schema";
import type { ILLMProvider } from "@/core/ai/provider";
import type { BusinessConfig, IncomingMessage, Lead, PersonaConfig } from "@/core/types";

const config: BusinessConfig = {
  slug: "jeans",
  name: "Jeans al por mayor",
  currency: "COP",
  services: [
    {
      id: "jean-102",
      name: "Jean clásico",
      description: "Denim azul",
      price: 35000,
      modo: "pedido",
      referencia: "102",
      variantes: { nombre: "Talla", opciones: ["28", "30", "32"] },
    },
    { id: "correa", name: "Correa", description: "Cuero", price: 15000, modo: "pedido" },
  ],
  messages: {
    welcome: "¿Qué le provoca?",
    askName: "¿A nombre de quién?",
    askDate: "¿Fecha?",
    askConfirm: "¿Confirma?",
    serviceInfo: "{{servicio}} {{precio}}",
    captured: "Listo {{nombre}}",
    fallback: "No le entendí",
  },
  followUps: [],
};

const persona: PersonaConfig = { name: "Ana", tone: "cálida", language: "español de Colombia" };
const now = new Date("2026-11-22T15:00:00.000Z");

function msg(text: string): IncomingMessage {
  return { channel: "mock", businessSlug: "jeans", from: "573000000001", text, timestamp: now.toISOString() };
}

function ia(r: AgentResponse): ILLMProvider {
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
    async runAgent() {
      return r;
    },
  };
}

const turno = (texto: string, r: AgentResponse, lead: Lead | null = null) =>
  runAgentTurn(lead, msg(texto), config, ia(r), persona, [], now);

describe("T-104: tallas en modo agente", () => {
  it("«6 de la 30 y 6 de la 32» quedan como dos líneas y el resumen muestra cada talla", async () => {
    const r = await turno("Soy Carlos, mándeme 6 jeans de la 30 y 6 de la 32", {
      respuesta: "¡Listo!",
      acciones: [
        { tipo: "guardar_nombre", nombre: "Carlos" },
        { tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 6, variante: "30" },
        { tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 6, variante: "talla 32" },
        { tipo: "confirmar" },
      ],
    });
    expect(r!.lead.items).toEqual([
      { serviceId: "jean-102", cantidad: 6, variante: "30" },
      { serviceId: "jean-102", cantidad: 6, variante: "32" },
    ]);
    const texto = r!.messages[0].text;
    expect(texto).toContain("6x Jean clásico Ref 102 · Talla 30");
    expect(texto).toContain("6x Jean clásico Ref 102 · Talla 32");
  });

  it("sin talla no se cierra el pedido: el motor pregunta con las tallas reales", async () => {
    const r = await turno("Soy Carlos, quiero 6 jeans, confirmo", {
      respuesta: "¡Su pedido ya está con la dueña!",
      acciones: [
        { tipo: "guardar_nombre", nombre: "Carlos" },
        { tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 6 },
        { tipo: "confirmar" },
      ],
    });
    expect(r!.lead.stage).not.toBe("esperando_aprobacion");
    expect(r!.messages[0].text).toBe(
      "¿En qué talla quiere el Jean clásico Ref 102? Tenemos: 28, 30, 32. Si quiere varias, dígame cuántas de cada una 🙌",
    );
  });

  it("una talla que no existe no se anota y el cliente recibe las opciones", async () => {
    const r = await turno("6 de la talla 40", {
      respuesta: "¡Anotados 6 de la 40!",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 6, variante: "40" }],
    });
    expect(r!.lead.items ?? []).toEqual([]);
    expect(r!.messages[0].text).toContain("No tenemos esa talla");
    expect(r!.messages[0].text).toContain("28, 30, 32");
  });

  it("quitar una talla deja las demás", async () => {
    const lead = {
      id: "l1",
      businessSlug: "jeans",
      contact: "573000000001",
      channel: "mock",
      state: "interesado",
      stage: "carrito_abierto",
      serviceId: "jean-102",
      items: [
        { serviceId: "jean-102", cantidad: 6, variante: "30" },
        { serviceId: "jean-102", cantidad: 6, variante: "32" },
      ],
      followUpsSent: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    } as unknown as Lead;
    const r = await turno("quite la 30", {
      respuesta: "Listo, quité la 30.",
      acciones: [{ tipo: "quitar_producto", servicioId: "jean-102", variante: "30" }],
    }, lead);
    expect(r!.lead.items).toEqual([{ serviceId: "jean-102", cantidad: 6, variante: "32" }]);
  });

  it("un producto sin tallas sigue funcionando igual (y la IA no le puede inventar una)", async () => {
    const r = await turno("una correa", {
      respuesta: "Anotada la correa.",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "correa", cantidad: 1, variante: "XL" }],
    });
    expect(r!.lead.items).toEqual([{ serviceId: "correa", cantidad: 1 }]);
  });

  it("«mándeme la 102» reconoce el producto por su referencia", async () => {
    const r = await turno("mándeme la 102", { respuesta: "Claro, ¿en qué talla?", acciones: [] });
    expect(r!.lead.items?.[0]?.serviceId).toBe("jean-102");
  });
});

// T-123: un producto con talla Y color.
describe("T-123: varios detalles en modo agente", () => {
  const configDetalles: BusinessConfig = {
    ...config,
    services: [
      {
        id: "jean-102",
        name: "Jean clásico",
        description: "Denim",
        price: 35000,
        modo: "pedido",
        referencia: "102",
        detalles: [
          { nombre: "Talla", opciones: ["28", "30", "32"] },
          { nombre: "Color", opciones: ["Blanco", "Azul"] },
        ],
      },
    ],
  };
  const turnoD = (texto: string, r: AgentResponse, lead: Lead | null = null) =>
    runAgentTurn(lead, msg(texto), configDetalles, ia(r), persona, [], now);

  it("dos combinaciones quedan como dos líneas y el resumen las muestra", async () => {
    const r = await turnoD("Soy Carlos, 6 de la 30 blanco y 4 de la 32 azul", {
      respuesta: "¡Listo!",
      acciones: [
        { tipo: "guardar_nombre", nombre: "Carlos" },
        { tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 6, variante: "30 Blanco" },
        { tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 4, variante: "talla 32 color azul" },
        { tipo: "confirmar" },
      ],
    });
    expect(r!.lead.items).toEqual([
      { serviceId: "jean-102", cantidad: 6, variante: "Talla 30, Color Blanco" },
      { serviceId: "jean-102", cantidad: 4, variante: "Talla 32, Color Azul" },
    ]);
    expect(r!.messages[0].text).toContain("6x Jean clásico Ref 102 · Talla 30, Color Blanco");
  });

  it("con solo la talla no se anota inventado: pide el color que falta", async () => {
    const r = await turnoD("6 de la 30", {
      respuesta: "¡Listo, anotados!",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 6, variante: "30" }],
    });
    expect(r!.lead.items ?? []).toEqual([]);
    expect(r!.messages[0].text).toContain("¿qué color quiere?");
    expect(r!.messages[0].text).toContain("Blanco, Azul");
  });

  it("sin detalles todavía, no cierra el pedido y pregunta talla y color", async () => {
    const r = await turnoD("Soy Carlos, 6 jeans, confirmo", {
      respuesta: "¡Confirmado!",
      acciones: [
        { tipo: "guardar_nombre", nombre: "Carlos" },
        { tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 6 },
        { tipo: "confirmar" },
      ],
    });
    expect(r!.lead.stage).not.toBe("esperando_aprobacion");
    expect(r!.messages[0].text).toContain("talla y color");
  });
});

// T-109: en la prueba real, "2 de la 30 en azul" y después "y 1 de la 32"
// terminó anotado como "32 Azul" sin preguntar: la IA arrastró el color de
// la línea anterior. Con varios detalles, el motor solo acepta una opción que
// el cliente dijo para ESA línea.
describe("T-109: no asumir un detalle que el cliente no dijo", () => {
  const configDetalles: BusinessConfig = {
    ...config,
    services: [
      {
        id: "jean-102",
        name: "Jean clásico",
        description: "Denim",
        price: 35000,
        modo: "pedido",
        referencia: "102",
        detalles: [
          { nombre: "Talla", opciones: ["28", "30", "32"] },
          { nombre: "Color", opciones: ["Azul", "Negro"] },
        ],
      },
    ],
  };
  const conAzul = {
    id: "l1",
    businessSlug: "jeans",
    contact: "573000000001",
    channel: "mock",
    state: "interesado",
    stage: "carrito_abierto",
    serviceId: "jean-102",
    items: [{ serviceId: "jean-102", cantidad: 2, variante: "Talla 30, Color Azul" }],
    followUpsSent: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  } as unknown as Lead;
  const historial = [
    { role: "user" as const, text: "2 de la 30 en azul", timestamp: now.toISOString() },
    { role: "assistant" as const, text: "¡Listo! ¿Domicilio o recoge?", timestamp: now.toISOString() },
  ];
  const turnoH = (texto: string, r: AgentResponse, lead: Lead | null, history = historial) =>
    runAgentTurn(lead, msg(texto), configDetalles, ia(r), persona, history, now);

  it("«y 1 de la 32» no hereda el color de la otra línea: pregunta solo el color", async () => {
    const r = await turnoH("Y 1 de la 32", {
      respuesta: "¡Perfecto! Le sumamos 1 en Azul talla 32.",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 1, variante: "32 Azul" }],
    }, conAzul);
    expect(r!.lead.items).toEqual([{ serviceId: "jean-102", cantidad: 2, variante: "Talla 30, Color Azul" }]);
    expect(r!.messages[0].text).toContain("Talla 32");
    expect(r!.messages[0].text).toContain("¿qué color quiere?");
  });

  it("si lo dice en el mensaje («y 1 de la 32 en negro») se anota", async () => {
    const r = await turnoH("y 1 de la 32 en negro", {
      respuesta: "¡Listo!",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 1, variante: "32 Negro" }],
    }, conAzul);
    expect(r!.lead.items).toContainEqual({ serviceId: "jean-102", cantidad: 1, variante: "Talla 32, Color Negro" });
  });

  it("«otra igual pero en 32» sí repite el color", async () => {
    const r = await turnoH("otra igual pero en 32", {
      respuesta: "¡Listo!",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 1, variante: "32 Azul" }],
    }, conAzul);
    expect(r!.lead.items).toContainEqual({ serviceId: "jean-102", cantidad: 1, variante: "Talla 32, Color Azul" });
  });

  it("cambiar la cantidad de una línea que ya está no pide repetir todo", async () => {
    const r = await turnoH("mejor que sean 3", {
      respuesta: "¡Listo, 3!",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 3, variante: "30 Azul" }],
    }, conAzul);
    expect(r!.lead.items).toEqual([{ serviceId: "jean-102", cantidad: 3, variante: "Talla 30, Color Azul" }]);
  });

  it("el color dicho en un mensaje anterior, todavía sin usar, vale («azul» … «la 30»)", async () => {
    const r = await turnoH("la 30, 2 unidades", {
      respuesta: "¡Listo!",
      acciones: [{ tipo: "guardar_cantidad", servicioId: "jean-102", cantidad: 2, variante: "30 Azul" }],
    }, null, [
      { role: "user", text: "quiero el jean azul", timestamp: now.toISOString() },
      { role: "assistant", text: "¿Qué talla?", timestamp: now.toISOString() },
    ]);
    expect(r!.lead.items).toEqual([{ serviceId: "jean-102", cantidad: 2, variante: "Talla 30, Color Azul" }]);
  });
});
