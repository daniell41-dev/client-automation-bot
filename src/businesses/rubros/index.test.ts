import { describe, expect, it } from "vitest";
import { RUBROS_BASE } from "@/businesses/rubros";
import { parseBusinessConfig } from "@/core/config-schema";
import { modoDelItem } from "@/core/engine/modo-item";

describe("rubros base (T-40)", () => {
  it("son los del plan (T-110 suma ropa al por mayor)", () => {
    expect(RUBROS_BASE.map((r) => r.slug)).toEqual(["estetica", "peluqueria", "masajes", "restaurante", "ropa"]);
  });

  it.each(RUBROS_BASE)("$nombre pasa el schema (regla 5 de AGENTS.md)", (rubro) => {
    expect(parseBusinessConfig(JSON.parse(JSON.stringify(rubro.template)))).not.toBeNull();
  });

  it("belleza, peluquería y masajes agendan; el restaurante y la ropa venden", () => {
    for (const rubro of RUBROS_BASE) {
      const modos = new Set(rubro.template.services.map((s) => modoDelItem(s, rubro.template.catalogo)));
      expect([...modos]).toEqual([["restaurante", "ropa"].includes(rubro.slug) ? "pedido" : "cita"]);
    }
  });

  it("el restaurante viene con domicilio/recoger y comprobante activados", () => {
    const restaurante = RUBROS_BASE.find((r) => r.slug === "restaurante")!.template;
    expect(restaurante.pedidos?.enabled).toBe(true);
    expect(restaurante.pagos?.requiereComprobante).toBe(true);
  });

  it("ninguna plantilla nace con el bot encendido", () => {
    expect(RUBROS_BASE.every((r) => r.template.botActivo === false)).toBe(true);
  });

  it("T-110: solo la ropa trae referencia y detalles encendidos", () => {
    for (const rubro of RUBROS_BASE) {
      const campos = rubro.template.catalogo?.campos;
      const esperado = rubro.slug === "ropa";
      expect(campos?.referencia === true).toBe(esperado);
      expect(campos?.detalles === true).toBe(esperado);
    }
  });
});
