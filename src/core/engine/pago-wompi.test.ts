import { describe, expect, it } from "vitest";
import { decidirAccionWompi } from "@/core/engine/pago-wompi";

describe("decidirAccionWompi", () => {
  it("APPROVED (sin confirmar todavía) -> confirmar", () => {
    expect(decidirAccionWompi("APPROVED", false)).toEqual({ accion: "confirmar" });
  });

  it("DECLINED -> rechazar", () => {
    expect(decidirAccionWompi("DECLINED", false)).toEqual({ accion: "rechazar" });
  });

  it("VOIDED -> rechazar", () => {
    expect(decidirAccionWompi("VOIDED", false)).toEqual({ accion: "rechazar" });
  });

  it("ERROR -> rechazar", () => {
    expect(decidirAccionWompi("ERROR", false)).toEqual({ accion: "rechazar" });
  });

  it("PENDING -> ninguna (nunca descuenta stock a partir de un pago pendiente)", () => {
    expect(decidirAccionWompi("PENDING", false)).toEqual({ accion: "ninguna" });
  });

  it("idempotencia: un pedido YA confirmado ignora cualquier evento posterior, incluso otro APPROVED", () => {
    expect(decidirAccionWompi("APPROVED", true)).toEqual({ accion: "ninguna" });
    expect(decidirAccionWompi("DECLINED", true)).toEqual({ accion: "ninguna" });
  });
});
