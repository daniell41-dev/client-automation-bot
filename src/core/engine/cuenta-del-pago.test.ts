/**
 * T-153: un negocio con varias cuentas (Venezuela, Provincial, Banesco y
 * Pago Móvil) necesita saber a cuál le llegó cada pago. El banco que se ve
 * en la captura suele ser el DEL CLIENTE; lo que identifica la cuenta del
 * negocio es el número, el celular o la cédula de destino.
 */
import { describe, expect, it } from "vitest";
import { cuentaDelPago, describirCuenta } from "@/core/engine/cuenta-del-pago";
import type { CuentaPago } from "@/core/types";

const venezuela: CuentaPago = { entidad: "Banco de Venezuela", tipo: "ahorros", numero: "0102 0000 1111 22223333", titular: "Ana Pérez", documento: "11222333" };
const provincial: CuentaPago = { entidad: "Provincial", tipo: "ahorros", numero: "0108 0000 44 5555666677", titular: "Luis Rojas", documento: "9876543" };
const banesco: CuentaPago = { entidad: "Banesco", tipo: "corriente", numero: "0134 0000 88888 9991234", titular: "Luis Rojas", documento: "9876543" };
const pagoMovil: CuentaPago = { entidad: "Banco de Venezuela", tipo: "pago_movil", numero: "04125550101", titular: "Ana Pérez", documento: "11222333" };
const cuentas = [venezuela, provincial, banesco, pagoMovil];

describe("cuentaDelPago", () => {
  it("por el número de cuenta, aunque venga enmascarado («****1234»)", () => {
    expect(cuentaDelPago({ legible: "completo", cuentaDestino: "****1234" }, cuentas)).toEqual({ tipo: "cuenta", cuenta: banesco });
    expect(cuentaDelPago({ legible: "completo", cuentaDestino: "0108-0000-44-5555666677" }, cuentas)).toEqual({ tipo: "cuenta", cuenta: provincial });
  });

  it("un Pago Móvil por el celular de destino", () => {
    expect(cuentaDelPago({ legible: "completo", telefonoDestino: "0412-5550101" }, cuentas)).toEqual({ tipo: "cuenta", cuenta: pagoMovil });
  });

  it("la cédula sola no alcanza si esa persona tiene dos cuentas; con el banco de destino, sí", () => {
    expect(cuentaDelPago({ legible: "completo", documentoDestino: "V-9.876.543" }, cuentas)).toEqual({ tipo: "sin_datos" });
    expect(cuentaDelPago({ legible: "completo", documentoDestino: "V-9.876.543", bancoDestino: "BANESCO" }, cuentas)).toEqual({ tipo: "cuenta", cuenta: banesco });
  });

  it("el banco del cliente (campo «banco») no se usa: puede pagar desde Banesco a cualquier cuenta", () => {
    expect(cuentaDelPago({ legible: "completo", banco: "Banesco" }, cuentas)).toEqual({ tipo: "sin_datos" });
  });

  it("un número visible que no es de ninguna cuenta del negocio", () => {
    expect(cuentaDelPago({ legible: "completo", cuentaDestino: "0105 0000 1111 2222 3333" }, cuentas)).toEqual({ tipo: "no_coincide" });
  });

  it("menos de 4 dígitos visibles no dicen nada", () => {
    expect(cuentaDelPago({ legible: "completo", cuentaDestino: "***92" }, cuentas)).toEqual({ tipo: "sin_datos" });
  });

  it("sin cuentas cargadas, no hay con qué comparar", () => {
    expect(cuentaDelPago({ legible: "completo", cuentaDestino: "****1234" }, [])).toEqual({ tipo: "sin_datos" });
  });
});

describe("describirCuenta", () => {
  it("banco, titular y los últimos 4 dígitos", () => {
    expect(describirCuenta(banesco)).toBe("Banesco · Luis Rojas (…1234)");
    expect(describirCuenta(pagoMovil)).toBe("Pago Móvil Banco de Venezuela · Ana Pérez (…0101)");
  });
});
