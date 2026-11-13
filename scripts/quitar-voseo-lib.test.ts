import { describe, expect, it } from "vitest";
import { RUBROS_BASE } from "@/businesses/rubros";
import { parseBusinessConfig } from "@/core/config-schema";
import { quitarVoseoConfig, quitarVoseoTexto, tieneVoseo, TEXTOS_POR_DEFECTO } from "./quitar-voseo-lib";

describe("quitarVoseoTexto", () => {
  it("cambia un default viejo exacto por el nuevo, aunque solo tutee", () => {
    expect(quitarVoseoTexto("¡Hola! ¿Qué servicio te interesa?")).toBe("¡Hola! ¿Qué servicio le interesa?");
    expect(quitarVoseoTexto("¿Confirmás tu pedido?")).toBe("¿Confirma su pedido?");
  });

  it("en un texto propio con voseo cambia verbos y pronombres, respetando mayúsculas", () => {
    expect(quitarVoseoTexto("Tenés que mandarnos tu comprobante acá")).toBe(
      "Tiene que mandarnos su comprobante aquí",
    );
    expect(quitarVoseoTexto("¿Querés que te lo mandemos? Contanos")).toBe("¿Quiere que se lo mandemos? Cuéntenos");
  });

  it("deja tal cual un texto propio que solo tutea (puede ser el tono que eligió el negocio)", () => {
    const tuteo = "¡Hola! ¿Qué te provoca hoy? Escríbenos tu pedido";
    expect(tieneVoseo(tuteo)).toBe(false);
    expect(quitarVoseoTexto(tuteo)).toBe(tuteo);
  });

  it("no confunde palabras que contienen una forma de voseo", () => {
    expect(quitarVoseoTexto("Vosotros sois los mejores")).toBe("Vosotros sois los mejores");
  });

  it("ningún default nuevo sigue teniendo voseo", () => {
    for (const nuevo of Object.values(TEXTOS_POR_DEFECTO)) expect(tieneVoseo(nuevo), nuevo).toBe(false);
  });
});

describe("quitarVoseoConfig", () => {
  const base = {
    messages: { welcome: "¡Hola! ¿Qué servicio te interesa?", captured: "Listo, gracias" },
    followUps: [{ threshold: "2h", afterMinutes: 120, message: "¿Querés que te avisemos?" }],
    services: [{ id: "acá", name: "Combo acá", description: "Pedilo ya", keywords: ["acá"], price: 1 }],
    pedidos: { enabled: true, pregunta: "¿Te lo mandamos o lo recogés?", opciones: ["Comer acá"] },
    ai: { enabled: true, reglas: [{ keywords: ["horario"], respuesta: "Abrimos a las 9, vení cuando quieras" }] },
    personas: { whatsapp: { name: "Ana", tone: "Cercano", language: "español colombiano informal" } },
  };

  it("cambia solo los textos que lee el cliente y lista cada cambio", () => {
    const { config, cambios } = quitarVoseoConfig(base);
    expect(config.messages).toEqual({ welcome: "¡Hola! ¿Qué servicio le interesa?", captured: "Listo, gracias" });
    expect((config.followUps as { message: string }[])[0].message).toBe("¿Quiere que le avisemos?");
    expect((config.pedidos as { pregunta: string }).pregunta).toBe("¿Se lo mandamos o lo recoge?");
    expect((config.ai as { reglas: { respuesta: string }[] }).reglas[0].respuesta).toBe(
      "Abrimos a las 9, venga cuando quieras",
    );
    expect((config.personas as { whatsapp: { language: string } }).whatsapp.language).toBe(
      "español de Colombia, trato de usted",
    );
    expect(cambios.map((c) => c.campo)).toEqual([
      "messages.welcome",
      "followUps[0].message",
      "services[0].description",
      "pedidos.pregunta",
      "ai.reglas[0].respuesta",
      "personas.whatsapp.language",
    ]);
  });

  it("no toca nombres, palabras clave ni opciones de entrega (el bot los usa para reconocer y para pedidos viejos)", () => {
    const { config } = quitarVoseoConfig(base);
    const servicio = (config.services as { id: string; name: string; keywords: string[] }[])[0];
    expect(servicio).toMatchObject({ id: "acá", name: "Combo acá", keywords: ["acá"] });
    expect((config.pedidos as { opciones: string[] }).opciones).toEqual(["Comer acá"]);
  });

  it("T-79: cambia el preset \"Cercano\" viejo (tuteaba) y deja un tono propio tal cual", () => {
    const viejo = "Cálido y cercano. Usa emojis con moderación, tutea al cliente y responde con energía positiva.";
    const { config, cambios } = quitarVoseoConfig({
      personas: { whatsapp: { name: "Ana", tone: viejo, language: "x" }, instagram: { name: "B", tone: "Fun and trendy", language: "x" } },
    });
    const personas = config.personas as Record<string, { tone: string }>;
    expect(personas.whatsapp.tone).toContain("trata al cliente de usted");
    expect(personas.instagram.tone).toBe("Fun and trendy");
    expect(cambios.map((c) => c.campo)).toEqual(["personas.whatsapp.tone"]);
  });

  it("no modifica el objeto original", () => {
    quitarVoseoConfig(base);
    expect(base.messages.welcome).toBe("¡Hola! ¿Qué servicio te interesa?");
  });

  it("las plantillas de rubro actuales no tienen nada que cambiar y siguen pasando el schema", () => {
    for (const rubro of RUBROS_BASE) {
      const { config, cambios } = quitarVoseoConfig(rubro.template as unknown as Record<string, unknown>);
      expect(cambios, rubro.slug).toEqual([]);
      expect(parseBusinessConfig(config), rubro.slug).not.toBeNull();
    }
  });
});
