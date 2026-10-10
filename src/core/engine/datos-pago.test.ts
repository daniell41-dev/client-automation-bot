import { describe, expect, it } from "vitest";
import {
  cuentasDeConfig,
  destinosDePago,
  normalizarReferencia,
  normalizarTelefono,
  textoCuentasPago,
  textoDatosPago,
} from "@/core/engine/datos-pago";

describe("textoDatosPago", () => {
  it("arma una línea por dato cargado", () => {
    expect(textoDatosPago({ nequi: "300 000 0000", llaveBreB: "@sabores", titular: "Sabores del Sur" })).toBe(
      "Nequi: 300 000 0000\nLlave Bre-B: @sabores\nA nombre de: Sabores del Sur",
    );
  });

  it("omite lo vacío y devuelve '' si no hay nada", () => {
    expect(textoDatosPago({ nequi: "3000000000", llaveBreB: " " })).toBe("Nequi: 3000000000");
    expect(textoDatosPago(undefined)).toBe("");
  });
});

describe("normalizarReferencia", () => {
  it("la misma referencia escrita distinto queda igual", () => {
    expect(normalizarReferencia("m 0834-12")).toBe("M083412");
    expect(normalizarReferencia("M083412")).toBe("M083412");
  });

  it("vacía devuelve undefined", () => {
    expect(normalizarReferencia(" ")).toBeUndefined();
    expect(normalizarReferencia(undefined)).toBeUndefined();
  });
});

describe("normalizarTelefono", () => {
  it("con o sin indicativo, con o sin espacios, es el mismo número", () => {
    expect(normalizarTelefono("+57 300 123 4567")).toBe("3001234567");
    expect(normalizarTelefono("573001234567")).toBe("3001234567");
    expect(normalizarTelefono("300-123-4567")).toBe("3001234567");
  });

  it("un número enmascarado no se puede comparar", () => {
    expect(normalizarTelefono("***4567")).toBeUndefined();
    expect(normalizarTelefono("300 XXX 4567")).toBeUndefined();
  });
});

describe("textoCuentasPago (T-45)", () => {
  it("un bloque por cuenta, con tipo, número y titular", () => {
    expect(
      textoCuentasPago({
        cuentas: [
          { entidad: "Nequi", tipo: "billetera", numero: "300 000 0000", titular: "Laura Pérez" },
          { entidad: "Bancolombia", tipo: "ahorros", numero: "123-456789-01", titular: "Laura Pérez", documento: "CC 1.090.000.000" },
        ],
      }),
    ).toBe(
      "*Nequi*\nCelular: 300 000 0000\nA nombre de: Laura Pérez\n\n" +
        "*Bancolombia*\nCuenta de ahorros: 123-456789-01\nA nombre de: Laura Pérez (CC 1.090.000.000)",
    );
  });

  it("sin cuentas usa el formato viejo de datosPago", () => {
    expect(textoCuentasPago({ datosPago: { nequi: "3000000000" } })).toBe("Nequi: 3000000000");
    expect(textoCuentasPago(undefined)).toBe("");
  });

  it("con cuentas ignora datosPago", () => {
    expect(
      textoCuentasPago({
        datosPago: { nequi: "3000000000" },
        cuentas: [{ entidad: "Bre-B", tipo: "llave", numero: "@sabores" }],
      }),
    ).toBe("*Bre-B*\nLlave Bre-B: @sabores");
  });
});

describe("destinosDePago (T-45)", () => {
  it("junta el destino declarado, el Nequi viejo y todas las cuentas", () => {
    expect(
      destinosDePago({
        telefonoDestino: "3001112233",
        datosPago: { nequi: "3000000000" },
        cuentas: [{ entidad: "Davivienda", tipo: "ahorros", numero: "0550 1234 5678" }],
      }),
    ).toEqual(["3001112233", "3000000000", "0550 1234 5678"]);
    expect(destinosDePago(undefined)).toEqual([]);
  });
});

describe("cuentasDeConfig (T-45)", () => {
  it("convierte el Nequi y la llave viejos en cuentas", () => {
    expect(cuentasDeConfig({ datosPago: { nequi: "3000000000", llaveBreB: "@sabores", titular: "Laura" } })).toEqual([
      { entidad: "Nequi", tipo: "billetera", numero: "3000000000", titular: "Laura" },
      { entidad: "Bre-B", tipo: "llave", numero: "@sabores", titular: "Laura" },
    ]);
  });

  it("si ya hay cuentas, las devuelve tal cual", () => {
    const cuentas = [{ entidad: "Davivienda", tipo: "ahorros" as const, numero: "0550" }];
    expect(cuentasDeConfig({ cuentas, datosPago: { nequi: "3000000000" } })).toBe(cuentas);
    expect(cuentasDeConfig(undefined)).toEqual([]);
  });
});
