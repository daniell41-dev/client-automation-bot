import { describe, expect, it } from "vitest";
import { mostrarDetalles, mostrarReferencia } from "@/core/catalogo-campos";
import type { Service } from "@/core/types";

const plato: Service = { id: "p", name: "Bandeja", description: "", price: 1, modo: "pedido" };

describe("T-110: referencia y detalles según el rubro", () => {
  it("sin declarar (restaurante, negocios viejos) quedan ocultos", () => {
    expect(mostrarReferencia(undefined, plato)).toBe(false);
    expect(mostrarDetalles({ campos: { stock: true } }, plato)).toBe(false);
  });

  it("el rubro (o la dueña) los enciende", () => {
    expect(mostrarReferencia({ campos: { referencia: true } }, plato)).toBe(true);
    expect(mostrarDetalles({ campos: { detalles: true } }, plato)).toBe(true);
  });

  it("un producto que ya los tiene los sigue mostrando aunque estén apagados (no se esconde un dato guardado)", () => {
    const jean: Service = { ...plato, referencia: "102", detalles: [{ nombre: "Talla", opciones: ["30"] }] };
    expect(mostrarReferencia({ campos: { referencia: false } }, jean)).toBe(true);
    expect(mostrarDetalles({ campos: { detalles: false } }, jean)).toBe(true);
    const viejo: Service = { ...plato, variantes: { nombre: "Talla", opciones: ["30"] } };
    expect(mostrarDetalles(undefined, viejo)).toBe(true);
  });
});
