/**
 * T-115: en la prueba real, con el resumen todavía sin confirmar, la IA
 * escribió "Su pedido está listo para recoger en el local". El cliente lee
 * que ya está hecho y no confirma.
 */
import { describe, expect, it } from "vitest";
import { prometeCierre } from "@/core/ai/promete-cierre";
import { runAgentTurn } from "@/core/ai/agent";
import type { AgentResponse } from "@/core/ai/agent-schema";
import type { ILLMProvider } from "@/core/ai/provider";
import type { BusinessConfig, IncomingMessage, PersonaConfig } from "@/core/types";

describe("prometeCierre", () => {
  it.each([
    "Su pedido está listo para recoger en el local.",
    "¡Listo! Ya quedó confirmado su pedido 🙌",
    "Su pedido quedó registrado, ya se lo enviamos.",
    "¡Perfecto! Ya va en camino.",
    "Su pedido ya está con la dueña.",
    // T-115b: segunda prueba real, con otras palabras.
    "¡Excelente! Se lo reservamos para recoger en el local.",
    "Cuando llegue, ¡le estaremos esperando con su plato!",
    "¡Excelente elección! Le apartamos 2 unidades del Jean.",
  ])("«%s» da por hecho el pedido", (texto) => {
    expect(prometeCierre(texto)).toBe(true);
  });

  it.each([
    "¿Se lo enviamos a domicilio o lo recoge en el local?",
    "¿Confirma su pedido?",
    "¡Claro! Le anoto 2 correas.",
    "Cuando confirme, la dueña lo revisa y le avisamos.",
    "¿Le confirmamos el pedido para recoger en el local?",
  ])("«%s» no promete nada", (texto) => {
    expect(prometeCierre(texto)).toBe(false);
  });
});

const config: BusinessConfig = {
  slug: "tienda",
  name: "Tienda",
  currency: "COP",
  services: [{ id: "correa", name: "Correa", description: "Cuero", price: 15000, modo: "pedido" }],
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
const msg = (text: string): IncomingMessage => ({
  channel: "mock",
  businessSlug: "tienda",
  from: "573000000001",
  text,
  timestamp: now.toISOString(),
});
const ia = (r: AgentResponse): ILLMProvider => ({
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
});

describe("T-115: el motor no deja pasar un «listo» antes de confirmar", () => {
  it("con el resumen por confirmar, se descarta el texto que da el pedido por hecho", async () => {
    const r = await runAgentTurn(
      null,
      msg("Soy Valero, 2 correas"),
      config,
      ia({
        respuesta: "¡Hola Valero! Su pedido está listo para recoger en el local.",
        acciones: [
          { tipo: "guardar_nombre", nombre: "Valero" },
          { tipo: "guardar_cantidad", servicioId: "correa", cantidad: 2 },
        ],
      }),
      persona,
      [],
      now,
    );
    const texto = r!.messages[0].text;
    expect(texto).not.toContain("listo para recoger");
    expect(texto).toContain("2x Correa");
    expect(r!.lead.stage).toBe("esperando_confirmacion");
  });

  it("si el texto de la IA trae otra pregunta, va solo el resumen (una pregunta a la vez)", async () => {
    const r = await runAgentTurn(
      null,
      msg("Soy Valero, 2 correas"),
      config,
      ia({
        respuesta: "¡Gracias, Valero! ¿Me regala su nombre completo o está bien solo Valero?",
        acciones: [
          { tipo: "guardar_nombre", nombre: "Valero" },
          { tipo: "guardar_cantidad", servicioId: "correa", cantidad: 2 },
        ],
      }),
      persona,
      [],
      now,
    );
    const texto = r!.messages[0].text;
    expect(texto).not.toContain("nombre completo");
    expect(texto.trim().endsWith("¿Confirma su pedido?")).toBe(true);
  });

  it("nunca sale «don/doña»: se deja solo el nombre", async () => {
    const r = await runAgentTurn(
      null,
      msg("Valero"),
      config,
      ia({ respuesta: "¡Muchas gracias, don/doña Valero! ✨", acciones: [{ tipo: "guardar_nombre", nombre: "Valero" }] }),
      persona,
      [],
      now,
    );
    expect(r!.messages[0].text).toContain("¡Muchas gracias, Valero! ✨");
  });

  it("un texto normal se conserva antes del resumen", async () => {
    const r = await runAgentTurn(
      null,
      msg("Soy Valero, 2 correas"),
      config,
      ia({
        respuesta: "¡Con gusto, Valero!",
        acciones: [
          { tipo: "guardar_nombre", nombre: "Valero" },
          { tipo: "guardar_cantidad", servicioId: "correa", cantidad: 2 },
        ],
      }),
      persona,
      [],
      now,
    );
    expect(r!.messages[0].text.startsWith("¡Con gusto, Valero!")).toBe(true);
  });
});
