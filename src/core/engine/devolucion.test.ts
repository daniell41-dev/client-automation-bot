import { describe, expect, it } from "vitest";
import { devolucionPendiente, mensajePedirCuenta, pareceCuenta } from "@/core/engine/devolucion";

describe("pareceCuenta (T-67)", () => {
  it("reconoce un Nequi o una cuenta, con o sin separadores", () => {
    expect(pareceCuenta("Nequi 3001234567 Carlos Valero")).toBe(true);
    expect(pareceCuenta("Bancolombia ahorros 123-456789-01, Carlos")).toBe(true);
    expect(pareceCuenta("300 123 4567")).toBe(true);
  });

  it("no toma como cuenta un mensaje normal de la conversación", () => {
    expect(pareceCuenta("hola")).toBe(false);
    expect(pareceCuenta("quiero 2 platos de prueba")).toBe(false);
    expect(pareceCuenta("sí 12")).toBe(false);
    expect(pareceCuenta("calle 10 # 5-23")).toBe(false);
  });
});

describe("devolucionPendiente (T-67)", () => {
  it("pendiente mientras se espera la cuenta o la transferencia; no cuando ya se devolvió", () => {
    expect(devolucionPendiente({ devolucion: { estado: "pidiendo_cuenta" } })).toBe(true);
    expect(devolucionPendiente({ devolucion: { estado: "pendiente", cuenta: "Nequi 300" } })).toBe(true);
    expect(devolucionPendiente({ devolucion: { estado: "devuelta" } })).toBe(false);
    expect(devolucionPendiente({})).toBe(false);
  });
});

describe("mensajePedirCuenta (T-67)", () => {
  it("no promete la devolución: la condiciona a que la plata haya salido", () => {
    expect(mensajePedirCuenta("$ 100")).toContain("Si la transferencia de $ 100 salió de tu cuenta");
  });
});
