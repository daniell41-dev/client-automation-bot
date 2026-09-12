import { describe, expect, it } from "vitest";
import {
  buildAgentSystemPrompt,
  buildAgentUserMessage,
  parseAgentResponse,
} from "@/core/ai/agent-prompt";
import type { AgentTurnInput } from "@/core/ai/provider";

const baseInput: AgentTurnInput = {
  businessName: "Estética Bella",
  currency: "COP",
  locale: "es-CO",
  persona: { name: "Isabella", tone: "cálida", language: "español colombiano" },
  services: [
    {
      id: "limpieza-facial",
      name: "Limpieza facial",
      description: "Limpieza profunda",
      price: 120000,
      durationMinutes: 60,
      categoria: "Faciales",
    },
    {
      id: "unas",
      name: "Uñas",
      description: "Manicure semipermanente",
      price: 60000,
      durationMinutes: 45,
    },
  ],
  lead: { yaConfirmado: false, offTopicCount: 0 },
  history: [],
  message: "Hola",
  nowISO: "2026-09-12T15:00:00.000Z", // sábado 12 de septiembre de 2026, 10:00 en Bogotá
  timezone: "America/Bogota",
};

describe("buildAgentSystemPrompt — fecha de hoy (T-20)", () => {
  it("incluye la fecha de hoy en la zona horaria del negocio", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("Hoy es");
    expect(prompt).toContain("sábado");
    expect(prompt).toContain("12 de septiembre de 2026");
  });

  it("usa la hora local del negocio, no la de UTC crudo", () => {
    // 15:00 UTC son las 10:00 en Bogotá (UTC-5) — si se leyera en UTC diría 15:00.
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("10:");
    expect(prompt).not.toContain("15:00 (hora del negocio)");
  });
});

describe("buildAgentSystemPrompt", () => {
  it("incluye el nombre, tono y catálogo con precios formateados", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("Isabella");
    expect(prompt).toContain("Estética Bella");
    expect(prompt).toContain('id="limpieza-facial"');
    expect(prompt).toContain('id="unas"');
    expect(prompt).toContain("120.000");
    expect(prompt).toContain("60 minutos");
  });

  it("incluye el rubro cuando está configurado", () => {
    const prompt = buildAgentSystemPrompt({ ...baseInput, rubro: "restaurante" });
    expect(prompt).toContain("restaurante");
  });

  it("no menciona rubro cuando no está configurado", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).not.toContain("(rubro:");
  });

  it("incluye horarios solo si hay", () => {
    const sinHorarios = buildAgentSystemPrompt(baseInput);
    expect(sinHorarios).not.toContain("Horarios de atención");

    const conHorarios = buildAgentSystemPrompt({
      ...baseInput,
      horarios: [{ dow: 1, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] }],
    });
    expect(conHorarios).toContain("Horarios de atención");
    expect(conHorarios).toContain("Lunes: 09:00 a 19:00");
  });

  it("ordena los días lunes→domingo y junta varios tramos con \"y\"", () => {
    const prompt = buildAgentSystemPrompt({
      ...baseInput,
      horarios: [
        { dow: 0, abierto: false, tramos: [] }, // domingo, va último
        {
          dow: 1, // lunes, va primero
          abierto: true,
          tramos: [
            { desde: "09:00", hasta: "13:00" },
            { desde: "15:00", hasta: "19:00" },
          ],
        },
      ],
    });
    const idxLunes = prompt.indexOf("- Lunes:");
    const idxDomingo = prompt.indexOf("- Domingo:");
    expect(idxLunes).toBeGreaterThan(-1);
    expect(idxDomingo).toBe(-1); // domingo cerrado no aparece en la lista de abiertos
    expect(prompt).toContain("Lunes: 09:00 a 13:00 y 15:00 a 19:00");
  });

  it("incluye la modalidad de pedidos con sus opciones EXACTAS, solo si el negocio la usa", () => {
    const sinPedidos = buildAgentSystemPrompt(baseInput);
    expect(sinPedidos).not.toContain("pregunta la modalidad de entrega");

    const conPedidos = buildAgentSystemPrompt({
      ...baseInput,
      pedidos: { pregunta: "¿Retirás o comés acá?", opciones: ["Retirar", "Comer aquí"] },
    });
    expect(conPedidos).toContain("¿Retirás o comés acá?");
    expect(conPedidos).toContain("Retirar, Comer aquí");
  });

  it("incluye el knowledge del negocio cuando está configurado", () => {
    const prompt = buildAgentSystemPrompt({
      ...baseInput,
      knowledge: "Aceptamos tarjetas y transferencias.",
    });
    expect(prompt).toContain("Aceptamos tarjetas y transferencias.");
  });

  it("incluye las reglas rápidas del negocio como respuestas oficiales, solo si hay", () => {
    const sinReglas = buildAgentSystemPrompt(baseInput);
    expect(sinReglas).not.toContain("Respuestas oficiales del negocio");

    const conReglas = buildAgentSystemPrompt({
      ...baseInput,
      reglas: [{ keywords: ["envios", "domicilio"], respuesta: "Hacemos envíos a todo Bogotá." }],
    });
    expect(conReglas).toContain("Respuestas oficiales del negocio");
    expect(conReglas).toContain("Hacemos envíos a todo Bogotá.");
    expect(conReglas).toContain("envios");
  });

  it("instruye a ser breve (tono de WhatsApp, sin markdown ni listas largas)", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toMatch(/breve/i);
    expect(prompt).toMatch(/whatsapp/i);
  });

  it("resume los datos ya conocidos del cliente", () => {
    const prompt = buildAgentSystemPrompt({
      ...baseInput,
      lead: {
        name: "Carlos",
        serviceId: "unas",
        tentativeDate: "mañana",
        entrega: undefined,
        yaConfirmado: false,
        offTopicCount: 0,
      },
    });
    expect(prompt).toContain("nombre: Carlos");
    expect(prompt).toContain("servicio elegido (id): unas");
    expect(prompt).toContain("fecha tentativa: mañana");
  });

  it("dice 'ninguno todavía' cuando no hay datos del cliente", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("ninguno todavía");
  });

  it("avisa cuántas veces se fue del tema, solo si ya pasó al menos una vez", () => {
    const sinDesvio = buildAgentSystemPrompt(baseInput);
    expect(sinDesvio).not.toContain("desvió del tema");

    const conDesvio = buildAgentSystemPrompt({
      ...baseInput,
      lead: { ...baseInput.lead, offTopicCount: 2 },
    });
    expect(conDesvio).toContain("2 veces");
  });

  it("avisa de forma DESTACADA cuando la cita ya está confirmada", () => {
    const prompt = buildAgentSystemPrompt({
      ...baseInput,
      lead: { ...baseInput.lead, name: "Carlos", serviceId: "unas", yaConfirmado: true },
    });
    expect(prompt).toContain("YA ESTÁ CONFIRMADA");
    expect(prompt).toMatch(/NO vuelvas a pedirle/i);
    expect(prompt).toMatch(/reserva NUEVA/i);
  });

  it("no incluye ese aviso cuando la cita todavía no está confirmada", () => {
    expect(buildAgentSystemPrompt(baseInput)).not.toContain("YA ESTÁ CONFIRMADA");
  });

  it("documenta la acción 'reiniciar' como la única forma de corregir datos viejos", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain('"reiniciar"');
    expect(prompt).toMatch(/solo agregan, no borran/i);
  });

  it("instruye el formato de salida en JSON estricto", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toMatch(/JSON/i);
    expect(prompt).toContain('"respuesta"');
    expect(prompt).toContain('"acciones"');
  });

  it("nunca inventa servicios/precios: instruye a usar SOLO el catálogo dado", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toMatch(/nunca inventes otro/i);
  });
});

describe("buildAgentUserMessage", () => {
  it("incluye el historial reciente y el mensaje actual", () => {
    const msg = buildAgentUserMessage({
      ...baseInput,
      history: [
        { role: "user", text: "Hola", timestamp: "" },
        { role: "assistant", text: "¡Hola! ¿En qué te ayudo?", timestamp: "" },
      ],
      message: "quiero uñas",
    });
    expect(msg).toContain("Cliente: Hola");
    expect(msg).toContain("Isabella: ¡Hola! ¿En qué te ayudo?");
    expect(msg).toContain("Mensaje actual del cliente: quiero uñas");
  });

  it("marca el inicio de conversación cuando no hay historial", () => {
    const msg = buildAgentUserMessage(baseInput);
    expect(msg).toContain("(inicio de conversación)");
  });
});

describe("parseAgentResponse", () => {
  it("parsea un JSON válido con acciones", () => {
    const raw = JSON.stringify({
      respuesta: "¡Con gusto! ¿Cuál es tu nombre?",
      acciones: [{ tipo: "elegir_servicio", servicioId: "unas" }],
    });
    const result = parseAgentResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperaba ok:true");
    expect(result.value.respuesta).toBe("¡Con gusto! ¿Cuál es tu nombre?");
    expect(result.value.acciones).toEqual([{ tipo: "elegir_servicio", servicioId: "unas" }]);
  });

  it("tolera que el modelo envuelva el JSON en fences de markdown", () => {
    const raw = '```json\n{"respuesta": "Hola", "acciones": []}\n```';
    const result = parseAgentResponse(raw);
    expect(result.ok && result.value.respuesta).toBe("Hola");
  });

  it("acepta 'acciones' ausente (default vacío)", () => {
    const result = parseAgentResponse('{"respuesta": "Hola"}');
    expect(result.ok && result.value.acciones).toEqual([]);
  });

  it("devuelve motivo 'vacio' si el texto crudo está vacío", () => {
    const result = parseAgentResponse("");
    expect(result).toEqual({ ok: false, motivo: "vacio", raw: "" });
  });

  it("devuelve motivo 'no-json' si no es JSON válido", () => {
    const result = parseAgentResponse("esto no es json");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.motivo).toBe("no-json");
  });

  it("devuelve motivo 'schema' si falta 'respuesta'", () => {
    const result = parseAgentResponse('{"acciones": []}');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.motivo).toBe("schema");
  });

  it("descarta (no invalida todo) una acción con un 'tipo' desconocido, si hay otras válidas", () => {
    const raw = JSON.stringify({
      respuesta: "Hola",
      acciones: [{ tipo: "hacer_magia" }, { tipo: "guardar_nombre", nombre: "Carlos" }],
    });
    const result = parseAgentResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.acciones).toEqual([
      { tipo: "guardar_nombre", nombre: "Carlos" },
    ]);
  });

  it("una respuesta con SOLO una acción de 'tipo' desconocido queda con acciones vacío (no falla)", () => {
    const raw = JSON.stringify({ respuesta: "Hola", acciones: [{ tipo: "hacer_magia" }] });
    const result = parseAgentResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.acciones).toEqual([]);
  });

  it("descarta una acción a la que le falta el campo requerido, sin invalidar el resto", () => {
    const raw = JSON.stringify({
      respuesta: "Hola",
      acciones: [{ tipo: "elegir_servicio" }, { tipo: "confirmar" }],
    });
    const result = parseAgentResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.acciones).toEqual([{ tipo: "confirmar" }]);
  });

  it("recorta el texto crudo a 300 caracteres en el motivo de fallo", () => {
    const raw = "x".repeat(500);
    const result = parseAgentResponse(raw);
    expect(!result.ok && result.raw.length).toBe(300);
  });

  it("acepta las 7 acciones válidas del contrato", () => {
    const raw = JSON.stringify({
      respuesta: "ok",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "unas" },
        { tipo: "guardar_nombre", nombre: "Carlos" },
        { tipo: "guardar_fecha", fecha: "mañana" },
        { tipo: "guardar_modalidad", modalidad: "Retirar" },
        { tipo: "confirmar" },
        { tipo: "fuera_de_contexto" },
        { tipo: "reiniciar" },
      ],
    });
    const result = parseAgentResponse(raw);
    expect(result.ok && result.value.acciones).toHaveLength(7);
  });
});

describe("parseAgentResponse — rescates cuando el JSON no es válido a la primera", () => {
  it("rescata el objeto si el modelo lo rodeó de prosa", () => {
    const raw = 'Claro, acá va: {"respuesta": "¡Hola!", "acciones": []} espero que sirva';
    const result = parseAgentResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.respuesta).toBe("¡Hola!");
    expect(result.ok && result.rescatado).toBe(true);
  });

  it("rescata solo el texto de 'respuesta' si el JSON viene truncado a la mitad", () => {
    const raw = '{"respuesta": "¡Sí, tenemos disponibilidad para maña';
    const result = parseAgentResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.respuesta).toBe("¡Sí, tenemos disponibilidad para maña");
    expect(result.ok && result.value.acciones).toEqual([]);
    expect(result.ok && result.rescatado).toBe(true);
  });

  it("un JSON completo y válido a la primera NO se marca como rescatado", () => {
    const result = parseAgentResponse('{"respuesta": "Hola", "acciones": []}');
    expect(result.ok && result.rescatado).toBeUndefined();
  });

  it("si ni el objeto balanceado ni el regex encuentran 'respuesta', devuelve 'no-json'", () => {
    const raw = "esto no es json ni tiene nada rescatable";
    const result = parseAgentResponse(raw);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.motivo).toBe("no-json");
  });
});
