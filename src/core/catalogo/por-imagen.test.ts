/**
 * T-156: el cliente le toma captura al catálogo del negocio ("¿tienes este
 * pantalón?") y la manda. Casi siempre se ve la referencia: leerla es exacto.
 * Si no se ve, solo se ofrecen parecidos para que el cliente confirme: dos
 * jeans pueden verse idénticos y diferir en una pinza.
 */
import { describe, expect, it } from "vitest";
import { limpiarTextoVisible, productosDeImagen } from "@/core/catalogo/por-imagen";
import type { ImageDescription } from "@/core/ai/image-schema";
import type { Service } from "@/core/types";

const jean = (ref: string, nombre: string, categoria: string): Service => ({
  id: `ref-${ref.toLowerCase()}`,
  name: nombre,
  description: "",
  price: 129900,
  modo: "pedido",
  referencia: ref,
  categoria,
});

const catalogo: Service[] = [
  jean("B1167", "Skinny dama jean stretch tiro alto 2 pinzas moldeador tono azul claro", "Skinny"),
  jean("B1168", "Skinny dama jean stretch tiro alto 3 pinzas clasico tono azul claro", "Skinny"),
  jean("B1165", "Skinny dama jean stretch tiro alto 3 pinzas clasico tono negro", "Skinny"),
  jean("B203", "Bota dama jean stretch tiro alto 3 pinzas clasico tono azul hielo", "Bota"),
  jean("B900", "Short dama jean stretch tiro alto urbano tono negro", "Short"),
  jean("B2026", "Mom dama jean rigido tiro alto cargo tono gris", "Mom"),
];

const foto = (cambios: Partial<ImageDescription>): ImageDescription => ({
  tipoProducto: "pantalón jean",
  textoVisible: [],
  esRecipeMedico: false,
  confianza: "alta",
  ...cambios,
});
const refs = (r: ReturnType<typeof productosDeImagen>) => ("productos" in r ? r.productos.map((s) => s.referencia) : []);

describe("productosDeImagen: la referencia se ve en la captura", () => {
  it("«REF 1167» encuentra la B1167, aunque el precio diga 129.900 y exista una B900", () => {
    const r = productosDeImagen(foto({ textoVisible: ["REF 1167", "Skinny 2 pinzas", "$129.900"] }), catalogo);
    expect(r.tipo).toBe("referencia");
    expect(refs(r)).toEqual(["B1167"]);
  });

  it("la referencia completa o con espacios («B 203», «b-203»)", () => {
    expect(refs(productosDeImagen(foto({ textoVisible: ["B 203"] }), catalogo))).toEqual(["B203"]);
    expect(refs(productosDeImagen(foto({ textoVisible: ["Ref: b-203"] }), catalogo))).toEqual(["B203"]);
  });

  it("una página con varios productos devuelve todos los que se ven", () => {
    const r = productosDeImagen(foto({ textoVisible: ["B1167", "B1168", "B203"] }), catalogo);
    expect(r.tipo).toBe("referencia");
    expect(refs(r)).toEqual(["B1167", "B1168", "B203"]);
  });

  it("la fecha y la hora de la captura no se confunden con referencias (27/11/2026, 10:45, 87%)", () => {
    const r = productosDeImagen(foto({ textoVisible: ["10:45", "87%", "27/11/2026"] }), catalogo);
    expect(r.tipo).not.toBe("referencia");
  });
});

describe("productosDeImagen: no se ve la referencia", () => {
  it("por cómo se ve, ofrece parecidos (nunca afirma cuál es)", () => {
    const r = productosDeImagen(foto({ categoria: "Skinny", atributos: ["skinny", "azul claro", "pinzas"] }), catalogo);
    expect(r.tipo).toBe("parecidos");
    expect(refs(r)).toEqual(expect.arrayContaining(["B1167", "B1168"]));
    expect(refs(r)).not.toContain("B203");
  });

  it("nada parecido: ninguno", () => {
    const r = productosDeImagen(foto({ tipoProducto: "chaqueta de cuero", atributos: ["cuero", "cremallera"] }), catalogo);
    expect(r).toEqual({ tipo: "ninguno" });
  });
});

describe("productosDeImagen: catálogos sin referencias siguen como antes", () => {
  const repuestos: Service[] = [
    { id: "a", name: "Filtro de aceite Toyota", description: "", price: 1, categoria: "Aceite", keywords: ["fa-2201"] },
    { id: "b", name: "Filtro de aire Mazda", description: "", price: 1, categoria: "Filtros", keywords: ["fr-100"] },
  ];

  it("por palabra clave leída en el empaque", () => {
    const r = productosDeImagen(foto({ tipoProducto: "filtro", textoVisible: ["FA-2201"] }), repuestos);
    expect(r).toEqual({ tipo: "legado", productos: [repuestos[0]] });
  });

  it("por categoría, como antes (sin búsqueda por parecido)", () => {
    const r = productosDeImagen(foto({ tipoProducto: "filtro", categoria: "Filtros" }), repuestos);
    expect(r).toEqual({ tipo: "legado", productos: [repuestos[1]] });
  });
});

describe("limpiarTextoVisible", () => {
  it("quita precios, fechas, horas y porcentajes; deja referencias y nombres", () => {
    expect(limpiarTextoVisible(["$ 129.900", "Bs. 3.850", "129,900", "27/11/2026", "10:45", "87%", "REF 1167", "Skinny"])).toEqual([
      "REF 1167",
      "Skinny",
    ]);
  });
});
