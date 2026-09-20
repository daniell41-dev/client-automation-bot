import { describe, expect, it } from "vitest";
import { crearRubroSchema } from "@/app/backoffice/rubro-schema";
import { businessConfigSchema } from "@/core/config-schema";
import { plantilla } from "@/businesses/_template/config";

const valido = {
  slug: "barberia",
  nombre: "Barbería",
  descripcion: "Cortes y arreglo de barba.",
};

describe("crearRubroSchema", () => {
  it("acepta un formulario válido", () => {
    expect(crearRubroSchema.safeParse(valido).success).toBe(true);
  });

  it("rechaza el nombre vacío, con el mensaje que ve el admin", () => {
    const result = crearRubroSchema.safeParse({ ...valido, nombre: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.nombre?.[0]).toBe("El nombre es obligatorio.");
    }
  });

  it("rechaza un slug que no es kebab-case", () => {
    for (const slug of ["Barbería Don Juan", "barberia_1", "Barberia", "barberia!", ""]) {
      const result = crearRubroSchema.safeParse({ ...valido, slug });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.slug?.[0]).toContain("kebab-case");
      }
    }
  });

  it("la descripción es opcional", () => {
    expect(crearRubroSchema.safeParse({ slug: "barberia", nombre: "Barbería" }).success).toBe(true);
  });

  // La razón de ser de este schema: el rubro nace con una plantilla que lleva
  // su slug adentro, así que todo slug que acá pase tiene que pasar también en
  // `businessConfigSchema`. Si los dos regex se separan, un rubro se crea bien
  // y después falla al crear el negocio, con un error que apunta a la
  // plantilla en vez de al slug.
  it("todo slug que acepta acá también lo acepta businessConfigSchema", () => {
    for (const slug of ["barberia", "estetica-bella", "spa-3", "a"]) {
      expect(crearRubroSchema.safeParse({ ...valido, slug }).success).toBe(true);
      expect(businessConfigSchema.safeParse({ ...plantilla, slug }).success).toBe(true);
    }
  });
});
