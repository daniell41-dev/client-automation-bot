import { describe, expect, it } from "vitest";
import { armarPanel, columnaDe, mensajePedidoListo, validarEntrega } from "@/core/engine/panel-pedidos";
import type { Pedido } from "@/core/storage/pedido-repository";

function pedido(overrides: Partial<Pedido>): Pedido {
  return {
    id: "p",
    numero: 1,
    negocio: "neg-1",
    leadId: "l",
    contacto: "57300",
    items: [],
    total: 10000,
    moneda: "COP",
    estado: "por_verificar",
    creadoEn: "2026-10-10T10:00:00.000Z",
    actualizadoEn: "2026-10-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("armarPanel", () => {
  it("reparte por columna y oculta rechazados y vencidos", () => {
    const panel = armarPanel([
      pedido({ id: "a", estado: "esperando_pago" }),
      pedido({ id: "b", estado: "aprobado" }),
      pedido({ id: "c", estado: "listo" }),
      pedido({ id: "d", estado: "entregado" }),
      pedido({ id: "e", estado: "rechazado" }),
      pedido({ id: "f", estado: "vencido" }),
    ]);
    expect(panel.por_verificar.map((p) => p.id)).toEqual(["a"]);
    expect(panel.en_preparacion.map((p) => p.id)).toEqual(["b"]);
    expect(panel.listo.map((p) => p.id)).toEqual(["c"]);
    expect(panel.entregado.map((p) => p.id)).toEqual(["d"]);
    expect(columnaDe("rechazado")).toBeNull();
  });

  it("'Por verificar' va por monto, para cruzarla con Nequi", () => {
    const panel = armarPanel([
      pedido({ id: "chico", numero: 1, total: 8000 }),
      pedido({ id: "grande", numero: 2, total: 64000 }),
    ]);
    expect(panel.por_verificar.map((p) => p.id)).toEqual(["grande", "chico"]);
  });
});

describe("validarEntrega", () => {
  it("entrega solo un pedido aprobado y con el código correcto", () => {
    expect(validarEntrega(pedido({ estado: "aprobado", codigoRetiro: "4821" }), "4821")).toEqual({ ok: true });
    expect(validarEntrega(pedido({ estado: "listo", codigoRetiro: "4821" }), " 48-21 ")).toEqual({ ok: true });
  });

  it("un código equivocado o un pedido sin aprobar no se entrega", () => {
    expect(validarEntrega(pedido({ estado: "aprobado", codigoRetiro: "4821" }), "1111").ok).toBe(false);
    expect(validarEntrega(pedido({ estado: "por_verificar", codigoRetiro: "4821" }), "4821").ok).toBe(false);
  });
});

describe("mensajePedidoListo", () => {
  it("distingue recoger de domicilio", () => {
    expect(mensajePedidoListo(pedido({ numero: 3, modalidad: "Recoger en el local" }))).toContain("listo para recoger");
    expect(mensajePedidoListo(pedido({ numero: 3, modalidad: "Domicilio" }))).toContain("en camino");
  });
});
