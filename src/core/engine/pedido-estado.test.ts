import { describe, expect, it } from "vitest";
import {
  pedidoCerrado,
  pedidoPendienteDeDecision,
  puedeTransicionarPedido,
  transicionarPedido,
} from "@/core/engine/pedido-estado";

describe("pedido-estado — transiciones", () => {
  it("el camino feliz con comprobante: esperando_pago → por_verificar → aprobado → listo → entregado", () => {
    let estado = transicionarPedido("esperando_pago", "por_verificar");
    estado = transicionarPedido(estado, "aprobado");
    estado = transicionarPedido(estado, "listo");
    estado = transicionarPedido(estado, "entregado");
    expect(estado).toBe("entregado");
  });

  it("la dueña puede aprobar sin comprobante (verificó el pago por fuera)", () => {
    expect(transicionarPedido("esperando_pago", "aprobado")).toBe("aprobado");
  });

  it("un pedido aprobado se puede entregar sin pasar por 'listo'", () => {
    expect(transicionarPedido("aprobado", "entregado")).toBe("entregado");
  });

  it("un pedido rechazado NO se puede aprobar después (p. ej. un webhook atrasado)", () => {
    expect(() => transicionarPedido("rechazado", "aprobado")).toThrow(/inválida/);
  });

  it("un pedido aprobado no vuelve a quedar pendiente ni se rechaza", () => {
    expect(puedeTransicionarPedido("aprobado", "por_verificar")).toBe(false);
    expect(puedeTransicionarPedido("aprobado", "rechazado")).toBe(false);
  });

  it("ir al mismo estado es un no-op válido", () => {
    expect(transicionarPedido("aprobado", "aprobado")).toBe("aprobado");
  });
});

describe("pedido-estado — consultas", () => {
  it("entregado, rechazado y vencido son finales; el resto no", () => {
    expect(pedidoCerrado("entregado")).toBe(true);
    expect(pedidoCerrado("rechazado")).toBe(true);
    expect(pedidoCerrado("vencido")).toBe(true);
    expect(pedidoCerrado("aprobado")).toBe(false);
    expect(pedidoCerrado("esperando_pago")).toBe(false);
  });

  it("solo esperando_pago y por_verificar esperan una decisión", () => {
    expect(pedidoPendienteDeDecision("esperando_pago")).toBe(true);
    expect(pedidoPendienteDeDecision("por_verificar")).toBe(true);
    expect(pedidoPendienteDeDecision("aprobado")).toBe(false);
  });
});
