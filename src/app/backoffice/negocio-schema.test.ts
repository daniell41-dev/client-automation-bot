import { describe, expect, it } from "vitest";
import { actualizarNegocioSchema, crearNegocioSchema } from "@/app/backoffice/negocio-schema";

const validoCrear = {
  nombre: "Estética Bella",
  slug: "estetica-bella",
  owner_id: "user-1",
  rubro_id: "rubro-1",
  whatsapp_phone_number_id: "",
  plan: "free" as const,
};

describe("crearNegocioSchema", () => {
  it("acepta un formulario válido", () => {
    expect(crearNegocioSchema.safeParse(validoCrear).success).toBe(true);
  });

  it("rechaza el nombre vacío, con el mensaje que muestra el form", () => {
    const result = crearNegocioSchema.safeParse({ ...validoCrear, nombre: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.nombre?.[0]).toBe("El nombre es obligatorio.");
    }
  });

  it("rechaza un slug que no es kebab-case", () => {
    const result = crearNegocioSchema.safeParse({ ...validoCrear, slug: "Mi Negocio!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.slug?.[0]).toContain("kebab-case");
    }
  });

  it("rechaza sin cliente dueño ni rubro elegidos", () => {
    const result = crearNegocioSchema.safeParse({ ...validoCrear, owner_id: "", rubro_id: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.owner_id?.[0]).toBe("Elegí un cliente dueño.");
      expect(errors.rubro_id?.[0]).toBe("Elegí un rubro.");
    }
  });

  it("el WhatsApp es opcional", () => {
    const sinWhatsapp = {
      nombre: validoCrear.nombre,
      slug: validoCrear.slug,
      owner_id: validoCrear.owner_id,
      rubro_id: validoCrear.rubro_id,
      plan: validoCrear.plan,
    };
    expect(crearNegocioSchema.safeParse(sinWhatsapp).success).toBe(true);
  });

  it("rechaza un plan que no sea free/pro", () => {
    expect(crearNegocioSchema.safeParse({ ...validoCrear, plan: "premium" }).success).toBe(false);
  });
});

describe("actualizarNegocioSchema", () => {
  const validoActualizar = {
    id: "negocio-1",
    nombre: "Estética Bella",
    owner_id: "user-1",
    whatsapp_phone_number_id: "12345",
    plan: "pro" as const,
  };

  it("acepta un formulario válido (sin slug ni rubro: no se editan acá)", () => {
    expect(actualizarNegocioSchema.safeParse(validoActualizar).success).toBe(true);
  });

  it("rechaza el nombre vacío", () => {
    const result = actualizarNegocioSchema.safeParse({ ...validoActualizar, nombre: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.nombre?.[0]).toBe("El nombre es obligatorio.");
    }
  });

  it("rechaza sin cliente dueño", () => {
    const result = actualizarNegocioSchema.safeParse({ ...validoActualizar, owner_id: "" });
    expect(result.success).toBe(false);
  });
});
