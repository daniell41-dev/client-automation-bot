import { describe, expect, it } from "vitest";
import { anotarCambio, esAgregado, fijarCantidad, limpiarNota, resumenCarrito, totalCarrito } from "@/core/engine/flows/pedido";
import { revisarRespuestaIA } from "@/core/ai/filtro-respuesta";
import type { BusinessConfig, Service } from "@/core/types";

const bistec: Service = { id: "bistec", name: "Bistec a la plancha", description: "", price: 20000 };
const jean: Service = {
  id: "jean",
  name: "Jean",
  description: "",
  price: 35000,
  variantes: { nombre: "Talla", opciones: ["30", "32"] },
};
const config = { currency: "COP", locale: "es-CO", services: [bistec, jean] } as unknown as BusinessConfig;

describe("T-105: notas de cambio en el carrito", () => {
  it("anota el cambio en el producto y no cambia el total", () => {
    const items = anotarCambio([{ serviceId: "bistec", cantidad: 1 }], "bistec", "sin salsa");
    expect(items).toEqual([{ serviceId: "bistec", cantidad: 1, nota: "sin salsa" }]);
    expect(totalCarrito(items, config.services)).toBe(20000);
  });

  it("la nota nueva reemplaza la anterior, y vacía la quita", () => {
    let items = anotarCambio([{ serviceId: "bistec", cantidad: 1 }], "bistec", "sin salsa");
    items = anotarCambio(items, "bistec", "sin salsa, sin arroz");
    expect(items[0].nota).toBe("sin salsa, sin arroz");
    expect(anotarCambio(items, "bistec", undefined)[0]).toEqual({ serviceId: "bistec", cantidad: 1 });
  });

  it("con variante, solo en esa talla; sin variante, en todas las del producto", () => {
    const items = [
      { serviceId: "jean", cantidad: 6, variante: "30" },
      { serviceId: "jean", cantidad: 6, variante: "32" },
    ];
    expect(anotarCambio(items, "jean", "ruedo 2 cm", "30").map((i) => i.nota)).toEqual(["ruedo 2 cm", undefined]);
    expect(anotarCambio(items, "jean", "sin bolsillo").map((i) => i.nota)).toEqual(["sin bolsillo", "sin bolsillo"]);
  });

  it("la nota de la línea que esperaba talla pasa a la línea con talla", () => {
    const items = fijarCantidad([{ serviceId: "jean", cantidad: 6, nota: "sin bolsillo" }], "jean", 6, "30");
    expect(items).toEqual([{ serviceId: "jean", cantidad: 6, variante: "30", nota: "sin bolsillo" }]);
  });

  it("cambiar la cantidad conserva la nota", () => {
    const items = fijarCantidad([{ serviceId: "bistec", cantidad: 1, nota: "sin salsa" }], "bistec", 2);
    expect(items).toEqual([{ serviceId: "bistec", cantidad: 2, nota: "sin salsa" }]);
  });

  it("el resumen (y el aviso a la dueña, que usa el mismo) muestra la nota junto al producto", () => {
    const resumen = resumenCarrito([{ serviceId: "bistec", cantidad: 1, nota: "sin salsa" }], config.services, config);
    expect(resumen).toContain("1x Bistec a la plancha (sin salsa) — $");
  });
});

describe("T-105: limpieza y tipo de cambio", () => {
  it("limpia espacios, el 'nota:' de adelante y corta lo muy largo", () => {
    expect(limpiarNota("  Nota:   sin   arroz ")).toBe("sin arroz");
    expect(limpiarNota("   ")).toBeUndefined();
    expect(limpiarNota("a".repeat(300))!.length).toBe(140);
  });

  it("distingue quitar (no cuesta) de agregar (puede costar)", () => {
    expect(esAgregado("sin arroz, sin ensalada")).toBe(false);
    expect(esAgregado("la carne bien asada")).toBe(false);
    expect(esAgregado("con doble queso")).toBe(true);
    expect(esAgregado("extra papas")).toBe(true);
    expect(esAgregado("agregarle aguacate")).toBe(true);
  });

  it("'sin arroz' no lo confunde el filtro de T-98 con un regalo", () => {
    expect(revisarRespuestaIA("sin arroz, sin ensalada", config).ok).toBe(true);
    expect(revisarRespuestaIA("sin salsa y sin cebolla", config).ok).toBe(true);
  });
});
