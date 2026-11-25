/**
 * T-116: importador de productos. Las filas imitan la exportación real de
 * Tienda Nube del primer cliente mayorista (mismos encabezados, una fila por
 * talla, "ref:" en el nombre y la columna Costo), con datos inventados.
 */
import { describe, expect, it } from "vitest";
import { parsearCsv } from "@/core/catalogo/csv";
import {
  MAPEO_AURELA,
  MAPEO_TIENDANUBE,
  combinarCatalogo,
  detectarFormato,
  leerPrecio,
  leerProductos,
  sugerirMapeo,
} from "@/core/catalogo/importar";
import type { Service } from "@/core/types";

const ENCABEZADOS_TN =
  "Identificador de URL;Nombre;Categorías;Nombre de propiedad 1;Valor de propiedad 1;Nombre de propiedad 2;Valor de propiedad 2;Nombre de propiedad 3;Valor de propiedad 3;Precio;Precio promocional;Peso (kg);Alto (cm);Ancho (cm);Profundidad (cm);Stock;SKU;Código de barras;Mostrar en tienda;Envío sin cargo;Descripción;Tags;Título para SEO;Descripción para SEO;Marca;Producto Físico;MPN (Número de pieza del fabricante);Sexo;Rango de edad;Costo";

function filaTN(ref: string, nombre: string, talla: string, precio = "129900", promo = "99900"): string {
  return `jean-${ref};${nombre} ref:${ref};Skinny;Talla;${talla};;;;;${precio};${promo};0.5;30;25;4;;${ref}-T${talla};;SÍ;NO;"Jean de prueba; tiro alto";jeans;SEO;SEO desc;Marca;SÍ;${ref};Femenino;Adulto;55000`;
}

const csvTN = [
  ENCABEZADOS_TN,
  ...["6", "8", "10"].map((t) => filaTN("X101", "Skinny dama azul claro", t)),
  ...["6", "8", "10"].map((t) => filaTN("X102", "Skinny dama negro", t)),
].join("\r\n");

describe("parsearCsv", () => {
  it("lee `;`, CRLF, BOM y un `;` dentro de comillas", () => {
    const t = parsearCsv(`﻿${csvTN}`);
    expect(t.encabezados[0]).toBe("Identificador de URL");
    expect(t.filas).toHaveLength(6);
    expect(t.filas[0][20]).toBe("Jean de prueba; tiro alto");
  });

  it("detecta la coma como separador y entiende comillas escapadas", () => {
    const t = parsearCsv('Referencia,Nombre,Precio\nA1,"Jean ""clásico""",35000\n\n');
    expect(t.filas).toEqual([["A1", 'Jean "clásico"', "35000"]]);
  });
});

describe("detectarFormato y sugerirMapeo", () => {
  it("reconoce Tienda Nube y la plantilla de Aurela", () => {
    expect(detectarFormato(parsearCsv(csvTN).encabezados)).toBe("tiendanube");
    expect(detectarFormato(["Referencia", "Nombre", "Precio", "Tallas"])).toBe("aurela");
    expect(detectarFormato(["Código", "Producto", "Valor"])).toBe("otro");
  });

  it("adivina las columnas de un archivo propio por sinónimos", () => {
    const m = sugerirMapeo(["Código", "Producto", "Valor unitario", "Existencias", "Talla"]);
    expect(m).toMatchObject({ referencia: "Código", nombre: "Producto", precio: "Valor unitario", stock: "Existencias" });
    expect(m.listas).toEqual([{ detalle: "Talla", columna: "Talla" }]);
  });
});

describe("leerPrecio", () => {
  it.each([
    ["129900", 129900],
    ["$ 129.900", 129900],
    ["129.900,00", 129900],
    ["1.250.000", 1250000],
    ["99900.4", 99900],
    ["35,000", 35000],
  ])("«%s» → %d", (texto, esperado) => {
    expect(leerPrecio(texto)).toBe(esperado);
  });

  it("lo que no es precio da null", () => {
    expect(leerPrecio("")).toBeNull();
    expect(leerPrecio("a convenir")).toBeNull();
  });
});

describe("leerProductos — Tienda Nube", () => {
  const { encabezados, filas } = parsearCsv(csvTN);

  it("junta las filas de cada talla en un producto con su detalle Talla", () => {
    const { productos, errores } = leerProductos(encabezados, filas, MAPEO_TIENDANUBE);
    expect(errores).toEqual([]);
    expect(productos).toHaveLength(2);
    expect(productos[0]).toMatchObject({
      id: "ref-x101",
      name: "Skinny dama azul claro",
      referencia: "X101",
      price: 129900,
      categoria: "Skinny",
      modo: "pedido",
      disponible: true,
      detalles: [{ nombre: "Talla", opciones: ["6", "8", "10"] }],
    });
  });

  it("el Costo y las demás columnas no mapeadas nunca entran al producto", () => {
    const { productos } = leerProductos(encabezados, filas, MAPEO_TIENDANUBE);
    expect(JSON.stringify(productos)).not.toContain("55000");
    expect(Object.keys(productos[0]).sort()).toEqual(
      ["categoria", "description", "detalles", "disponible", "id", "modo", "name", "price", "referencia"].sort(),
    );
  });

  it("con «usar precio promocional», toma el promocional", () => {
    const { productos } = leerProductos(encabezados, filas, MAPEO_TIENDANUBE, { usarPrecioPromocional: true });
    expect(productos[0].price).toBe(99900);
  });

  it("un precio distinto en otra talla avisa y se queda con el de la primera fila", () => {
    const t = parsearCsv([ENCABEZADOS_TN, filaTN("X103", "Short", "6", "80000"), filaTN("X103", "Short", "8", "85000")].join("\n"));
    const r = leerProductos(t.encabezados, t.filas, MAPEO_TIENDANUBE);
    expect(r.productos[0].price).toBe(80000);
    expect(r.avisos[0]).toEqual({ fila: 3, mensaje: expect.stringContaining("otro precio") });
  });
});

describe("leerProductos — plantilla de Aurela y errores", () => {
  const csv = [
    "Referencia;Nombre;Precio;Categoría;Descripción;Tallas;Colores;Unidades disponibles;Disponible",
    "B1;Jean clásico;35.000;Jeans;Denim;28, 30, 32;Azul, Negro;12;Sí",
    ";Sin referencia;10000;;;;;;",
    "B2;;20000;;;;;;",
    "B3;Correa;a convenir;;;;;;",
    "B4;Gorra;15000;;;;;;No",
  ].join("\n");
  const { encabezados, filas } = parsearCsv(csv);
  const r = leerProductos(encabezados, filas, MAPEO_AURELA);

  it("lee tallas y colores en lista, unidades y disponible", () => {
    expect(r.productos.find((p) => p.referencia === "B1")).toMatchObject({
      price: 35000,
      stock: 12,
      disponible: true,
      detalles: [
        { nombre: "Talla", opciones: ["28", "30", "32"] },
        { nombre: "Color", opciones: ["Azul", "Negro"] },
      ],
    });
    expect(r.productos.find((p) => p.referencia === "B4")?.disponible).toBe(false);
  });

  it("cada fila mala se informa con su número de Excel y no frena a las demás", () => {
    expect(r.errores).toEqual([
      { fila: 3, mensaje: "Falta la referencia." },
      { fila: 4, mensaje: "Falta el nombre (referencia B2)." },
      { fila: 5, mensaje: "El precio de B3 no es un número válido." },
    ]);
    expect(r.productos.map((p) => p.referencia)).toEqual(["B1", "B4"]);
  });

  it("sin las columnas obligatorias no lee nada y dice cuáles faltan", () => {
    const t = parsearCsv("Código;Producto\nA;B");
    expect(leerProductos(t.encabezados, t.filas, MAPEO_AURELA).errores[0].mensaje).toContain("referencia, nombre, precio");
  });
});

describe("combinarCatalogo", () => {
  const actual: Service[] = [
    { id: "bandeja", name: "Bandeja", description: "", price: 20000 },
    { id: "jean-102", name: "Jean viejo", description: "", price: 30000, referencia: "x101", keywords: ["jean"] },
  ];
  const importados: Service[] = [
    { id: "ref-x101", name: "Skinny azul", description: "Nuevo", price: 35000, referencia: "X101", modo: "pedido" },
    { id: "ref-x102", name: "Skinny negro", description: "", price: 35000, referencia: "X102", modo: "pedido" },
  ];

  it("actualiza por referencia (sin importar mayúsculas), agrega los nuevos y no toca lo demás", () => {
    const { catalogo, resumen } = combinarCatalogo(actual, importados);
    expect(resumen).toEqual({ nuevos: 1, actualizados: 1, sinCambios: 0, noIncluidos: 1 });
    expect(catalogo[0]).toBe(actual[0]);
    // Conserva su id y lo que es de la dueña (palabras clave); cambia lo del archivo.
    expect(catalogo[1]).toMatchObject({ id: "jean-102", keywords: ["jean"], name: "Skinny azul", price: 35000 });
    expect(catalogo[2].id).toBe("ref-x102");
  });

  it("subir el mismo archivo dos veces no cambia nada", () => {
    const primera = combinarCatalogo(actual, importados).catalogo;
    const segunda = combinarCatalogo(primera, importados);
    expect(segunda.resumen).toMatchObject({ nuevos: 0, actualizados: 0, sinCambios: 2 });
  });

  it("no pisa el id de otro producto", () => {
    const conChoque: Service[] = [{ id: "ref-x102", name: "Otro", description: "", price: 1 }];
    const { catalogo } = combinarCatalogo(conChoque, [importados[1]]);
    expect(catalogo.map((s) => s.id)).toEqual(["ref-x102", "ref-x102-2"]);
  });
});
