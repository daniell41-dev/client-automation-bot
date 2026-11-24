import { describe, expect, it } from "vitest";
import {
  detallesDe,
  etiquetaVariante,
  leerDetalles,
  opcionesNoDichas,
  preguntaDetalles,
  respuestaDetalleInvalido,
} from "@/core/engine/detalles";
import type { Service } from "@/core/types";

const base: Service = { id: "jean", name: "Jean", description: "", price: 35000, modo: "pedido" };
const conTallaYColor: Service = {
  ...base,
  detalles: [
    { nombre: "Talla", opciones: ["28", "30", "32"] },
    { nombre: "Color", opciones: ["Blanco", "Azul oscuro"] },
  ],
};
const soloTallaViejo: Service = { ...base, variantes: { nombre: "Talla", opciones: ["30", "32"] } };

describe("detallesDe (T-123)", () => {
  it("un producto de antes (con `variantes`) se lee como un solo detalle", () => {
    expect(detallesDe(soloTallaViejo)).toEqual([{ nombre: "Talla", opciones: ["30", "32"] }]);
  });

  it("`detalles` manda sobre `variantes`, y sin nada no hay detalles", () => {
    expect(detallesDe({ ...conTallaYColor, variantes: { nombre: "X", opciones: ["1"] } })).toHaveLength(2);
    expect(detallesDe(base)).toEqual([]);
  });
});

describe("leerDetalles (T-123)", () => {
  it("con un solo detalle se lee igual que en T-104", () => {
    expect(leerDetalles(soloTallaViejo, "talla 30").variante).toBe("30");
    expect(leerDetalles(soloTallaViejo, "34").variante).toBeUndefined();
  });

  it("con varios detalles arma la combinación con las opciones del catálogo", () => {
    expect(leerDetalles(conTallaYColor, "30 blanco").variante).toBe("Talla 30, Color Blanco");
    expect(leerDetalles(conTallaYColor, "color azul oscuro, talla 32").variante).toBe("Talla 32, Color Azul oscuro");
    expect(leerDetalles(conTallaYColor, "Talla 28, Color Blanco").variante).toBe("Talla 28, Color Blanco");
  });

  it("si falta un detalle no arma la combinación y dice cuál falta", () => {
    const r = leerDetalles(conTallaYColor, "30");
    expect(r.variante).toBeUndefined();
    expect(r.encontrados).toEqual([{ nombre: "Talla", opcion: "30" }]);
    expect(r.faltan.map((d) => d.nombre)).toEqual(["Color"]);
  });

  it("una opción que no existe no se acepta, ni la más parecida", () => {
    expect(leerDetalles(conTallaYColor, "34 blanco").variante).toBeUndefined();
    expect(leerDetalles(conTallaYColor, "300 blanco").variante).toBeUndefined();
  });
});

describe("preguntas y etiquetas (T-123)", () => {
  it("con varios detalles pregunta todos con sus opciones reales", () => {
    const p = preguntaDetalles(conTallaYColor, "Jean");
    expect(p).toContain("talla y color");
    expect(p).toContain("Talla: 28, 30, 32 · Color: Blanco, Azul oscuro");
  });

  it("con un solo detalle conserva la pregunta de T-104", () => {
    expect(preguntaDetalles(soloTallaViejo, "Jean")).toBe(
      "¿En qué talla quiere el Jean? Tenemos: 30, 32. Si quiere varias, dígame cuántas de cada una 🙌",
    );
  });

  it("si dijo solo la talla, pide solo el color", () => {
    const r = respuestaDetalleInvalido(conTallaYColor, "30", "Jean");
    expect(r).toContain("(Talla 30)");
    expect(r).toContain("¿qué color quiere?");
    expect(r).not.toContain("28, 30, 32");
  });

  it("la etiqueta del resumen no repite el nombre del detalle", () => {
    expect(etiquetaVariante(soloTallaViejo, "30")).toBe("Talla 30");
    expect(etiquetaVariante(conTallaYColor, "Talla 30, Color Blanco")).toBe("Talla 30, Color Blanco");
  });
});

describe("T-109: opcionesNoDichas", () => {
  const jean = {
    id: "j",
    name: "Jean",
    description: "",
    price: 1,
    detalles: [
      { nombre: "Talla", opciones: ["30", "32"] },
      { nombre: "Color", opciones: ["Azul", "Negro"] },
    ],
  } as Service;
  const enCarrito = ["Talla 30, Color Azul"];

  it("el color arrastrado de otra línea no cuenta como dicho", () => {
    expect(opcionesNoDichas(jean, "Talla 32, Color Azul", "y 1 de la 32", ["2 de la 30 en azul"], enCarrito)).toEqual([
      { nombre: "Color", opcion: "Azul" },
    ]);
  });
  it("dicho en el mensaje, con «igual» o en una línea que ya existe, vale", () => {
    expect(opcionesNoDichas(jean, "Talla 32, Color Negro", "1 de la 32 negro", [], enCarrito)).toEqual([]);
    expect(opcionesNoDichas(jean, "Talla 32, Color Azul", "otra igual en 32", [], enCarrito)).toEqual([]);
    expect(opcionesNoDichas(jean, "Talla 30, Color Azul", "mejor 3", [], enCarrito)).toEqual([]);
  });
  it("dicho antes y sin usar todavía, vale", () => {
    expect(opcionesNoDichas(jean, "Talla 30, Color Azul", "la 30", ["el azul"], [])).toEqual([]);
  });
  it("con un solo detalle no aplica", () => {
    const uno = { ...jean, detalles: [jean.detalles![0]] } as Service;
    expect(opcionesNoDichas(uno, "30", "uno más", [], [])).toEqual([]);
  });
});
