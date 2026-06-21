import { describe, expect, it } from "vitest";
import { render } from "@/core/engine/templating";

describe("render", () => {
  it("reemplaza una variable", () => {
    expect(render("Hola {{nombre}}", { nombre: "Laura" })).toBe("Hola Laura");
  });

  it("reemplaza varias variables", () => {
    const out = render("{{servicio}} cuesta {{precio}}", {
      servicio: "Limpieza facial",
      precio: "$120.000",
    });
    expect(out).toBe("Limpieza facial cuesta $120.000");
  });

  it("tolera espacios dentro de las llaves", () => {
    expect(render("Hola {{ nombre }}", { nombre: "Ana" })).toBe("Hola Ana");
  });

  it("convierte números a texto", () => {
    expect(render("Duración: {{min}} min", { min: 60 })).toBe("Duración: 60 min");
  });

  it("reemplaza variables ausentes por cadena vacía", () => {
    expect(render("Hola {{nombre}}!", {})).toBe("Hola !");
  });

  it("trata undefined y null como vacío", () => {
    expect(render("[{{a}}][{{b}}]", { a: undefined, b: null })).toBe("[][]");
  });

  it("deja intacto un texto sin variables", () => {
    expect(render("Sin variables aquí")).toBe("Sin variables aquí");
  });

  it("soporta guiones en el nombre de la variable", () => {
    expect(render("{{nombre-cliente}}", { "nombre-cliente": "Sofía" })).toBe("Sofía");
  });
});
