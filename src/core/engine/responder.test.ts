import { describe, expect, it } from "vitest";
import { respond } from "@/core/engine/responder";
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
    serviceInfo: "{{servicio}}: {{descripcion}}. Precio {{precio}}, dura {{duracion}}.",
    captured: "Perfecto {{nombre}}, anotamos {{servicio}} para {{fecha}}.",
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

  it("si el primer mensaje ya menciona un servicio, da info y pide el nombre", () => {
    const { lead, messages } = respond(
      null,
      msg("Hola, quiero info de limpieza facial"),
      config,
      now,
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].text).toContain("Limpieza facial");
    expect(messages[0].text).toContain("120.000");
    expect(messages[0].text).toContain("60 minutos");
    expect(messages[1].text).toContain("¿Cuál es tu nombre?");
    expect(lead.state).toBe("interesado");
    expect(lead.serviceId).toBe("limpieza-facial");
    expect(lead.stage).toBe("esperando_nombre");
  });
});

describe("respond — flujo completo de captura", () => {
  it("captura servicio → nombre → fecha y confirma", () => {
    // 1) Elige servicio
    let r = respond(null, msg("limpieza facial"), config, now);
    expect(r.lead.stage).toBe("esperando_nombre");

    // 2) Responde el nombre
    r = respond(r.lead, msg("Laura Pérez"), config, now);
    expect(r.lead.name).toBe("Laura Pérez");
    expect(r.lead.stage).toBe("esperando_fecha");
    expect(r.messages[0].text).toContain("¿Qué día");

    // 3) Responde la fecha
    r = respond(r.lead, msg("el viernes"), config, now);
    expect(r.lead.tentativeDate).toBe("el viernes");
    expect(r.lead.stage).toBe("datos_completos");
    expect(r.lead.state).toBe("interesado");
    expect(r.messages[0].text).toContain("Laura Pérez");
    expect(r.messages[0].text).toContain("Limpieza facial");
    expect(r.messages[0].text).toContain("el viernes");
  });

  it("selección por número de menú funciona tras el menú", () => {
    let r = respond(null, msg("Hola"), config, now);
    r = respond(r.lead, msg("2"), config, now);
    expect(r.lead.serviceId).toBe("unas");
    expect(r.lead.stage).toBe("esperando_nombre");
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
