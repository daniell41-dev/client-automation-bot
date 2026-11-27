/**
 * T-152: la lista de productos que arma el código cuando el asistente ofrece
 * varias opciones. En la prueba real con los 116 jeans salió un párrafo de
 * cinco líneas con nombres larguísimos repetidos; la lista corta se lee de
 * un vistazo y el precio lo pone el código, no la IA.
 */
import { describe, expect, it } from "vitest";
import { categoriasNombradas, lineaCategorias, listaDeProductos, nombreCorto } from "@/core/catalogo/lista";
import type { BusinessConfig, Service } from "@/core/types";

const jean = (ref: string, nombre: string, precio = 129900): Service => ({
  id: `ref-${ref.toLowerCase()}`,
  name: nombre,
  description: "",
  price: precio,
  modo: "pedido",
  referencia: ref,
  categoria: nombre.split(" ")[0],
});

// Como el catálogo real: "dama jean stretch tiro alto … tono" en casi todos.
const catalogo: Service[] = [
  jean("B1167", "Skinny dama jean stretch tiro alto 2 pinzas moldeador tono azul claro"),
  jean("B1168", "Skinny dama jean stretch tiro alto 3 pinzas clasico tono azul claro"),
  jean("B1165", "Skinny dama jean stretch tiro alto 3 pinzas clasico tono azul grafito claro"),
  jean("B203", "Bota dama jean stretch tiro alto 3 pinzas clasico tono azul hielo"),
  jean("B536", "Overol dama jean stretch tiro alto 3 pinzas clasico tono azul indigo", 143000),
  jean("B700", "Short dama jean stretch tiro alto urbano tono negro"),
  jean("B701", "Short dama jean stretch tiro alto cargo tono gris"),
  jean("B702", "Falda dama jean stretch tiro alto moderno tono negro"),
  jean("B703", "Recto dama jean stretch tiro medio clasico tono negro"),
  jean("B704", "Mom dama jean stretch tiro alto cargo tono blanco"),
];

const config = { currency: "COP", locale: "es-CO", services: catalogo } as unknown as BusinessConfig;
const sinNbsp = (t: string) => t.replace(/ /g, " ");

describe("nombreCorto", () => {
  it("quita lo que se repite en todo el catálogo y deja lo que distingue", () => {
    expect(nombreCorto(catalogo[0], catalogo)).toBe("Skinny 2 pinzas moldeador azul claro");
    expect(nombreCorto(catalogo[3], catalogo)).toBe("Bota 3 pinzas clasico azul hielo");
  });

  it("una palabra común se queda si va con otra distinta de la habitual («tiro medio», no «tiro alto»)", () => {
    expect(nombreCorto(catalogo[8], catalogo)).toBe("Recto tiro medio clasico negro");
  });

  it("en un catálogo chico deja el nombre tal cual", () => {
    const chico: Service[] = [
      { id: "a", name: "Bandeja paisa", description: "", price: 1 },
      { id: "b", name: "Limonada de coco", description: "", price: 1 },
    ];
    expect(nombreCorto(chico[0], chico)).toBe("Bandeja paisa");
  });
});

describe("listaDeProductos", () => {
  it("una línea por producto: número, referencia, nombre corto y precio real", () => {
    const lista = sinNbsp(listaDeProductos(catalogo.slice(0, 3), config));
    expect(lista.split("\n")).toEqual([
      "1. B1167 · Skinny 2 pinzas moldeador azul claro · $ 129.900",
      "2. B1168 · Skinny 3 pinzas clasico azul claro · $ 129.900",
      "3. B1165 · Skinny 3 pinzas clasico azul grafito claro · $ 129.900",
    ]);
  });

  it("sin referencia, solo nombre y precio", () => {
    const sinRef = { ...catalogo[4], referencia: undefined };
    expect(sinNbsp(listaDeProductos([sinRef], config))).toBe("1. Overol 3 pinzas clasico azul indigo · $ 143.000");
  });
});

describe("lineaCategorias", () => {
  it("nombra las categorías en una frase, hasta 8", () => {
    expect(lineaCategorias([{ nombre: "Skinny" }, { nombre: "Short" }, { nombre: "Bota" }])).toBe(
      "Lo que manejamos: Skinny, Short y Bota.",
    );
    const muchas = Array.from({ length: 12 }, (_, i) => ({ nombre: `C${i}` }));
    expect(lineaCategorias(muchas)).toBe("Lo que manejamos: C0, C1, C2, C3, C4, C5, C6 y C7.");
    expect(lineaCategorias([])).toBe("");
  });

  it("cuenta las que la IA ya nombró, sin importar tildes ni mayúsculas", () => {
    expect(categoriasNombradas("Tenemos skinny y SHORT", [{ nombre: "Skinny" }, { nombre: "Short" }, { nombre: "Bota" }])).toBe(2);
  });
});
