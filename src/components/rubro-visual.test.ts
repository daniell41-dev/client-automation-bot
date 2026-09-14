import { describe, expect, it } from "vitest";
import {
  camposDelNegocio,
  catalogCopy,
  catalogItemLabel,
  catalogLabel,
  rubroVisual,
  tipoCitas,
} from "@/components/rubro-visual";
import type { CatalogoConfig } from "@/core/types";

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

describe("catalogLabel/catalogCopy — con `catalogo` declarado (T-21)", () => {
  const catalogoTienda: CatalogoConfig = {
    etiqueta: { singular: "Producto", plural: "Productos" },
    modoPorDefecto: "pedido",
  };

  it("catalogLabel usa la etiqueta plural declarada, sin importar el nombre del rubro", () => {
    // El caso que el regex nunca iba a resolver: un rubro llamado "Kiosco".
    expect(catalogLabel("Kiosco", catalogoTienda)).toBe("Productos");
  });

  it("catalogItemLabel usa la etiqueta singular declarada", () => {
    expect(catalogItemLabel("Kiosco", catalogoTienda)).toBe("Producto");
  });

  it("catalogItemLabel sin `catalogo` cae al regex de siempre (compatibilidad)", () => {
    expect(catalogItemLabel("Restaurante")).toBe("Plato");
    expect(catalogItemLabel("Estética y belleza")).toBe("Servicio");
    expect(catalogItemLabel("Ferretería")).toBe("Producto");
  });

  it("catalogCopy con modoPorDefecto 'pedido' no ofrece 'Reservar turno'", () => {
    const copy = catalogCopy("Kiosco", catalogoTienda);
    expect(copy.previewCta).toBe("Agregar al pedido");
    expect(copy.previewSustantivo).toBe("nuestro producto");
  });

  it("catalogCopy con modoPorDefecto 'cita' SÍ ofrece 'Reservar turno', aunque el rubro se llame distinto", () => {
    const catalogoTaller: CatalogoConfig = {
      etiqueta: { singular: "Repuesto", plural: "Repuestos" },
      modoPorDefecto: "cita",
    };
    const copy = catalogCopy("Taller Don José", catalogoTaller);
    expect(copy.previewCta).toBe("Reservar turno");
    expect(copy.previewSaludo).toContain("repuestos");
  });

  it("sin `catalogo`, todo se comporta exactamente como antes de T-21", () => {
    expect(catalogLabel("Restaurante")).toBe("Menú");
    expect(catalogCopy("Restaurante").previewCta).toBe("Agregar al pedido");
  });
});

describe("camposDelNegocio — T-21", () => {
  function template(overrides: Record<string, unknown> = {}) {
    return {
      slug: "t",
      name: "T",
      currency: "COP",
      services: [{ id: "x", name: "X", description: "", price: 100, durationMinutes: 30 }],
      messages: {
        welcome: "h",
        askName: "n",
        askDate: "f",
        askConfirm: "c",
        serviceInfo: "i",
        captured: "k",
        fallback: "x",
      },
      followUps: [],
      ...overrides,
    };
  }

  it("sin `catalogo`: mismos chips que antes de T-21 (Duración sí, Stock no)", () => {
    const campos = camposDelNegocio("Estética y belleza", template());
    expect(campos).toEqual(["Servicio", "Precio", "Duración", "Categoría", "Disponible"]);
  });

  it("con `catalogo.campos.stock`, agrega el chip Stock", () => {
    const campos = camposDelNegocio(
      "Tienda",
      template({ catalogo: { modoPorDefecto: "pedido", campos: { stock: true } } }),
    );
    expect(campos).toContain("Stock");
  });

  it("con `catalogo.campos.duracion: false`, no ofrece el chip Duración", () => {
    const campos = camposDelNegocio(
      "Tienda",
      template({ catalogo: { modoPorDefecto: "pedido", campos: { duracion: false } } }),
    );
    expect(campos).not.toContain("Duración");
  });

  it("usa la etiqueta singular del rubro para el ítem, si está declarada", () => {
    const campos = camposDelNegocio(
      "Kiosco",
      template({ catalogo: { etiqueta: { singular: "Repuesto", plural: "Repuestos" } } }),
    );
    expect(campos[0]).toBe("Repuesto");
  });
});

describe("tipoCitas — T-21", () => {
  function template(overrides: Record<string, unknown> = {}) {
    return {
      slug: "t",
      name: "T",
      currency: "COP",
      services: [{ id: "x", name: "X", description: "", price: 100 }],
      messages: {
        welcome: "h",
        askName: "n",
        askDate: "f",
        askConfirm: "c",
        serviceInfo: "i",
        captured: "k",
        fallback: "x",
      },
      followUps: [],
      ...overrides,
    };
  }

  it("un rubro que vende (sin ítems de cita) dice 'Pedidos por WhatsApp', no 'Sin citas'", () => {
    const tipo = tipoCitas(
      "Tienda",
      template({
        services: [{ id: "x", name: "X", description: "", price: 100, modo: "pedido" }],
        catalogo: { modoPorDefecto: "pedido" },
      }),
    );
    expect(tipo).toBe("Pedidos por WhatsApp");
  });

  it("un ítem con `modo: 'cita'` cuenta como cita aunque el rubro venda por defecto", () => {
    const tipo = tipoCitas(
      "Taller",
      template({
        services: [
          { id: "service", name: "Cambio de aceite", description: "", price: 100, durationMinutes: 60, modo: "cita" },
        ],
        catalogo: { modoPorDefecto: "pedido" },
      }),
    );
    expect(tipo).toBe("Turnos");
  });

  it("sin `catalogo` y sin servicios reservables, sigue diciendo 'Sin citas' (compatibilidad)", () => {
    expect(tipoCitas("Ferretería", template())).toBe("Sin citas");
  });
});
