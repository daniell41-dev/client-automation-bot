import { describe, expect, it } from "vitest";
import { normalizarReferencia, normalizarTelefono, textoDatosPago } from "@/core/engine/datos-pago";

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
