import { describe, expect, it } from "vitest";
import {
  buildPaymentReceiptPrompt,
  parsePaymentReceipt,
} from "@/core/ai/payment-receipt-prompt";

describe("buildPaymentReceiptPrompt", () => {
  it("prohíbe explícitamente opinar sobre la validez del pago (§1.6, no negociable)", () => {
    const prompt = buildPaymentReceiptPrompt().toLowerCase();
    expect(prompt).toMatch(/no opinás|nunca verifica|no verificás/);
    expect(prompt).toContain("json");
  });
});

describe("parsePaymentReceipt", () => {
  it("parsea una captura de Nequi completa", () => {
    const raw = JSON.stringify({
      banco: "nequi",
      referencia: "M12345678",
      monto: 45000,
      moneda: "COP",
      fechaISO: "2026-09-15T19:14:00.000Z",
      telefonoDestino: "3001112233",
      nombreDestino: "Laura Pérez",
      legible: "completo",
    });
    expect(parsePaymentReceipt(raw)).toEqual({
      banco: "nequi",
      referencia: "M12345678",
      monto: 45000,
      moneda: "COP",
      fechaISO: "2026-09-15T19:14:00.000Z",
      telefonoDestino: "3001112233",
      nombreDestino: "Laura Pérez",
      legible: "completo",
    });
  });

  it("parsea una captura de Bancolombia con solo algunos datos (parcial)", () => {
    const raw = JSON.stringify({
      banco: "bancolombia",
      monto: 12000,
      moneda: "COP",
      legible: "parcial",
    });
    const result = parsePaymentReceipt(raw);
    expect(result?.legible).toBe("parcial");
    expect(result?.referencia).toBeUndefined();
  });

  it("parsea una captura de Pago Móvil (Venezuela) en VES", () => {
    const raw = JSON.stringify({
      banco: "mercantil",
      referencia: "998877",
      monto: 350,
      moneda: "VES",
      legible: "completo",
    });
    expect(parsePaymentReceipt(raw)?.moneda).toBe("VES");
  });

  it("una captura ilegible no trae ningún dato aprovechable", () => {
    const raw = JSON.stringify({ legible: "ilegible" });
    expect(parsePaymentReceipt(raw)).toEqual({ legible: "ilegible" });
  });

  it("acepta que venga envuelta en fences de markdown", () => {
    const raw = ["```json", JSON.stringify({ legible: "ilegible" }), "```"].join("\n");
    expect(parsePaymentReceipt(raw)?.legible).toBe("ilegible");
  });

  it("devuelve null si no es JSON", () => {
    expect(parsePaymentReceipt("esto no es json")).toBeNull();
  });

  it("devuelve null si falta el campo obligatorio 'legible'", () => {
    expect(parsePaymentReceipt(JSON.stringify({ banco: "nequi" }))).toBeNull();
  });

  it("devuelve null si 'legible' no es uno de los tres valores válidos", () => {
    expect(parsePaymentReceipt(JSON.stringify({ legible: "seguro" }))).toBeNull();
  });

  it("devuelve null ante una cadena vacía", () => {
    expect(parsePaymentReceipt("")).toBeNull();
  });
});
