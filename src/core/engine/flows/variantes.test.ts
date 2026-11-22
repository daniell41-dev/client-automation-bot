import { describe, expect, it } from "vitest";
import {
  agregarAlCarrito,
  cantidadesPorProducto,
  elegirVariante,
  faltaVariante,
  fijarCantidad,
  nombreItem,
  quitarDelCarrito,
  resumenCarrito,
  totalCarrito,
} from "@/core/engine/flows/pedido";
import { servicesSchema } from "@/core/config-schema";
import type { BusinessConfig, Service } from "@/core/types";

const jean: Service = {
  id: "jean-102",
  name: "Jean clásico",
  description: "Denim azul",
  price: 35000,
  referencia: "102",
  variantes: { nombre: "Talla", opciones: ["28", "30", "32", "34"] },
};
const camisa: Service = { id: "camisa", name: "Camisa", description: "", price: 20000 };
const config = { currency: "COP", locale: "es-CO", services: [jean, camisa] } as unknown as BusinessConfig;

describe("T-104: el mismo producto en dos tallas son dos líneas", () => {
  it("fijarCantidad separa por variante y no pisa la otra talla", () => {
    let items = fijarCantidad(undefined, "jean-102", 6, "30");
    items = fijarCantidad(items, "jean-102", 6, "32");
    items = fijarCantidad(items, "jean-102", 12, "30");
    expect(items).toEqual([
      { serviceId: "jean-102", cantidad: 12, variante: "30" },
      { serviceId: "jean-102", cantidad: 6, variante: "32" },
    ]);
  });

  it("al elegir la talla, la línea que esperaba talla se reemplaza (no queda duplicada)", () => {
    let items = fijarCantidad(undefined, "jean-102", 6);
    items = fijarCantidad(items, "jean-102", 6, "30");
    expect(items).toEqual([{ serviceId: "jean-102", cantidad: 6, variante: "30" }]);
  });

  it("agregarAlCarrito suma solo en la misma talla", () => {
    let items = agregarAlCarrito(undefined, "jean-102", 2, "30");
    items = agregarAlCarrito(items, "jean-102", 1, "30");
    items = agregarAlCarrito(items, "jean-102", 1, "32");
    expect(items).toEqual([
      { serviceId: "jean-102", cantidad: 3, variante: "30" },
      { serviceId: "jean-102", cantidad: 1, variante: "32" },
    ]);
  });

  it("quitar una talla deja las otras; sin talla, quita el producto entero", () => {
    const items = [
      { serviceId: "jean-102", cantidad: 6, variante: "30" },
      { serviceId: "jean-102", cantidad: 6, variante: "32" },
      { serviceId: "camisa", cantidad: 1 },
    ];
    expect(quitarDelCarrito(items, "jean-102", "30")).toEqual([items[1], items[2]]);
    expect(quitarDelCarrito(items, "jean-102")).toEqual([items[2]]);
  });

  it("el total cuenta cada talla al precio del producto", () => {
    const items = [
      { serviceId: "jean-102", cantidad: 6, variante: "30" },
      { serviceId: "jean-102", cantidad: 6, variante: "32" },
    ];
    expect(totalCarrito(items, config.services)).toBe(12 * 35000);
  });

  it("el inventario recibe UNA cantidad por producto (sumando las tallas)", () => {
    expect(
      cantidadesPorProducto([
        { serviceId: "jean-102", cantidad: 6, variante: "30" },
        { serviceId: "camisa", cantidad: 1 },
        { serviceId: "jean-102", cantidad: 4, variante: "32" },
      ]),
    ).toEqual([
      { serviceId: "jean-102", cantidad: 10 },
      { serviceId: "camisa", cantidad: 1 },
    ]);
  });
});

describe("T-104: cómo se llama cada línea", () => {
  it("nombre, referencia y talla", () => {
    expect(nombreItem(jean, "30")).toBe("Jean clásico Ref 102 · Talla 30");
    expect(nombreItem(jean)).toBe("Jean clásico Ref 102");
    expect(nombreItem(camisa)).toBe("Camisa");
  });

  it("no repite la referencia si el nombre ya la trae", () => {
    expect(nombreItem({ ...jean, name: "Jean Ref 102" }, "28")).toBe("Jean Ref 102 · Talla 28");
  });

  it("el resumen del pedido muestra la talla de cada línea", () => {
    const resumen = resumenCarrito(
      [
        { serviceId: "jean-102", cantidad: 6, variante: "30" },
        { serviceId: "jean-102", cantidad: 6, variante: "32" },
      ],
      config.services,
      config,
    );
    expect(resumen).toContain("6x Jean clásico Ref 102 · Talla 30 — $");
    expect(resumen).toContain("6x Jean clásico Ref 102 · Talla 32 — $");
  });
});

describe("T-104: reconocer la talla que dijo el cliente", () => {
  it("acepta la opción exacta, con el nombre adelante o con otras mayúsculas", () => {
    expect(elegirVariante(jean, "30")).toBe("30");
    expect(elegirVariante(jean, "talla 32")).toBe("32");
    expect(elegirVariante(jean, " Talla: 34 ")).toBe("34");
    const conLetras: Service = { ...camisa, variantes: { nombre: "Talla", opciones: ["S", "M", "L"] } };
    expect(elegirVariante(conLetras, "m")).toBe("M");
  });

  it("una talla que no existe no se acepta (no se inventa)", () => {
    expect(elegirVariante(jean, "36")).toBeUndefined();
    expect(elegirVariante(jean, "")).toBeUndefined();
    expect(elegirVariante(camisa, "30")).toBeUndefined();
  });

  it("faltaVariante encuentra la primera línea con opciones sin elegir", () => {
    expect(faltaVariante([{ serviceId: "camisa", cantidad: 1 }], config.services)).toBeUndefined();
    const falta = faltaVariante(
      [
        { serviceId: "camisa", cantidad: 1 },
        { serviceId: "jean-102", cantidad: 6 },
      ],
      config.services,
    );
    expect(falta?.service.id).toBe("jean-102");
  });
});

describe("T-104: validación del catálogo (Zod)", () => {
  it("acepta referencia y variantes, y un producto sin ellas sigue igual", () => {
    expect(servicesSchema.safeParse([jean, camisa]).success).toBe(true);
  });

  it("rechaza opciones repetidas o una lista vacía", () => {
    const repetidas = { ...jean, variantes: { nombre: "Talla", opciones: ["30", "30 "] } };
    expect(servicesSchema.safeParse([repetidas]).success).toBe(false);
    const vacia = { ...jean, variantes: { nombre: "Talla", opciones: [] } };
    expect(servicesSchema.safeParse([vacia]).success).toBe(false);
  });
});
