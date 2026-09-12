import { describe, expect, it } from "vitest";
import { catalogCopy, catalogLabel, rubroVisual } from "@/components/rubro-visual";

describe("catalogLabel", () => {
  it("gastronomía → Menú", () => {
    expect(catalogLabel("Restaurante")).toBe("Menú");
    expect(catalogLabel("Parrilla")).toBe("Menú");
  });

  it("estética/servicios → Servicios", () => {
    expect(catalogLabel("Estética y belleza")).toBe("Servicios");
    expect(catalogLabel("Barbería")).toBe("Servicios");
  });

  it("un rubro no reconocido (comercio/retail) → Catálogo", () => {
    expect(catalogLabel("Ferretería")).toBe("Catálogo");
    expect(catalogLabel(null)).toBe("Catálogo");
  });
});

describe("catalogCopy (T-18)", () => {
  it("Menú: placeholder, saludo y CTA de gastronomía", () => {
    const copy = catalogCopy("Restaurante");
    expect(copy.categoriaPlaceholder).toBe("Entradas");
    expect(copy.previewSaludo).toContain("tienen hoy");
    expect(copy.previewCta).toBe("Agregar al pedido");
  });

  it("Servicios: CTA es 'Reservar turno' (tiene sentido agendar una cita)", () => {
    const copy = catalogCopy("Estética y belleza");
    expect(copy.categoriaPlaceholder).toBe("Faciales");
    expect(copy.previewCta).toBe("Reservar turno");
  });

  it("Catálogo (rubro sin reconocer, ej. comercio): CTA es 'Agregar al pedido', no 'Reservar turno'", () => {
    const copy = catalogCopy("Ferretería");
    expect(copy.categoriaPlaceholder).toBe("Categoría");
    expect(copy.previewCta).toBe("Agregar al pedido");
    expect(copy.previewSustantivo).toBe("nuestro producto");
  });
});

describe("rubroVisual", () => {
  it("un rubro de estética usa el tinte de 'servicios', no el de 'gastro'", () => {
    const visual = rubroVisual("Estética y belleza");
    expect(visual.bg).toBe("bg-rubro-servicios-bg");
    expect(visual.ink).toBe("text-rubro-servicios-ink");
  });

  it("un rubro gastro usa el tinte de 'gastro'", () => {
    const visual = rubroVisual("Restaurante");
    expect(visual.bg).toBe("bg-rubro-gastro-bg");
  });
});
