import { describe, expect, it } from "vitest";
import { agregarAlCarrito, resumenCarrito, totalCarrito } from "@/core/engine/flows/pedido";
import type { BusinessConfig, CartItem, Service } from "@/core/types";

const config: BusinessConfig = {
  slug: "tienda-test",
  name: "Tienda Test",
  currency: "COP",
  locale: "es-CO",
  services: [],
  messages: {
    welcome: "",
    askName: "",
    askDate: "",
    askConfirm: "",
    serviceInfo: "",
    captured: "",
    fallback: "",
  },
  followUps: [],
};

const services: Service[] = [
  { id: "harina", name: "Harina 1 Kg", description: "Harina pan", price: 5000 },
  { id: "aceite", name: "Aceite 1 Lt", description: "Aceite vegetal", price: 12000 },
];

describe("agregarAlCarrito", () => {
  it("agrega un producto nuevo al carrito vacío", () => {
    const items = agregarAlCarrito(undefined, "harina", 2);
    expect(items).toEqual<CartItem[]>([{ serviceId: "harina", cantidad: 2 }]);
  });

  it("agrega un segundo producto distinto sin tocar el primero", () => {
    const items = agregarAlCarrito([{ serviceId: "harina", cantidad: 2 }], "aceite", 1);
    expect(items).toEqual<CartItem[]>([
      { serviceId: "harina", cantidad: 2 },
      { serviceId: "aceite", cantidad: 1 },
    ]);
  });

  it("suma la cantidad en la MISMA línea si el producto ya estaba (no duplica la fila)", () => {
    const items = agregarAlCarrito([{ serviceId: "harina", cantidad: 2 }], "harina", 1);
    expect(items).toEqual<CartItem[]>([{ serviceId: "harina", cantidad: 3 }]);
  });
});

describe("totalCarrito", () => {
  it("suma precio × cantidad de cada línea", () => {
    const items: CartItem[] = [
      { serviceId: "harina", cantidad: 2 },
      { serviceId: "aceite", cantidad: 1 },
    ];
    expect(totalCarrito(items, services)).toBe(2 * 5000 + 1 * 12000);
  });

  it("ignora una línea cuyo Service ya no existe en el catálogo", () => {
    const items: CartItem[] = [{ serviceId: "no-existe", cantidad: 5 }];
    expect(totalCarrito(items, services)).toBe(0);
  });
});

describe("resumenCarrito", () => {
  it("arma una línea por producto y el total al final", () => {
    const items: CartItem[] = [
      { serviceId: "harina", cantidad: 2 },
      { serviceId: "aceite", cantidad: 1 },
    ];
    const resumen = resumenCarrito(items, services, config);
    expect(resumen).toContain("2x Harina 1 Kg");
    expect(resumen).toContain("1x Aceite 1 Lt");
    expect(resumen.split("\n").at(-1)).toContain("Total");
  });
});
