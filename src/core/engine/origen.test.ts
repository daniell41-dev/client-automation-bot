import { describe, expect, it } from "vitest";
import { contarPorOrigen, describirOrigen, leerOrigen, registrarOrigen } from "@/core/engine/origen";
import type { Lead } from "@/core/types";

function lead(extra: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    businessSlug: "jeans",
    channel: "whatsapp",
    contact: "573001112233",
    state: "nuevo",
    stage: "inicio",
    createdAt: "2026-11-22T10:00:00.000Z",
    updatedAt: "2026-11-22T10:00:00.000Z",
    lastInboundAt: "2026-11-22T10:00:00.000Z",
    followUpsSent: [],
    ...extra,
  };
}

describe("registrarOrigen (T-120)", () => {
  it("guarda el origen la primera vez", () => {
    const l = lead();
    registrarOrigen(l, { tipo: "anuncio", id: "A1", titulo: "Jeans clásicos" });
    expect(l.origen).toEqual({ tipo: "anuncio", id: "A1", titulo: "Jeans clásicos" });
  });

  it("no pisa el origen con un anuncio posterior", () => {
    const l = lead({ origen: { tipo: "anuncio", id: "A1", titulo: "Jeans clásicos" } });
    registrarOrigen(l, { tipo: "anuncio", id: "B2", titulo: "Chaquetas" });
    expect(l.origen?.id).toBe("A1");
  });

  it("un mensaje sin origen no borra el que ya tenía", () => {
    const l = lead({ origen: { tipo: "publicacion", id: "P1" } });
    registrarOrigen(l, undefined);
    expect(l.origen).toEqual({ tipo: "publicacion", id: "P1" });
  });
});

describe("describirOrigen (T-120)", () => {
  it("usa el título del anuncio", () => {
    expect(describirOrigen({ tipo: "anuncio", titulo: "Jeans clásicos desde $35.000" })).toBe(
      "anuncio «Jeans clásicos desde $35.000»",
    );
  });

  it("sin título usa el texto, y sin nada dice al menos de dónde vino", () => {
    expect(describirOrigen({ tipo: "publicacion", texto: "Nueva colección" })).toBe("publicación «Nueva colección»");
    expect(describirOrigen({ tipo: "anuncio" })).toBe("un anuncio de Meta");
  });
});

describe("leerOrigen (T-120)", () => {
  it("descarta lo que no tiene un tipo conocido", () => {
    expect(leerOrigen(null)).toBeUndefined();
    expect(leerOrigen("anuncio")).toBeUndefined();
    expect(leerOrigen({ tipo: "otro", titulo: "x" })).toBeUndefined();
  });

  it("ignora campos que no son texto y recorta los largos", () => {
    const origen = leerOrigen({ tipo: "anuncio", id: 123, titulo: "  Jeans\n clásicos ", texto: "x".repeat(500) });
    expect(origen?.id).toBeUndefined();
    expect(origen?.titulo).toBe("Jeans clásicos");
    expect(origen?.texto?.length).toBe(200);
    expect(origen?.texto?.endsWith("…")).toBe(true);
  });
});

describe("contarPorOrigen (T-120)", () => {
  it("cuenta clientes por anuncio, de más a menos, y salta los que no tienen origen", () => {
    const conteo = contarPorOrigen([
      { tipo: "anuncio", id: "A1", titulo: "Jeans" },
      null,
      { tipo: "anuncio", id: "B2", titulo: "Chaquetas" },
      { tipo: "anuncio", id: "A1", titulo: "Jeans" },
      { basura: true },
    ]);
    expect(conteo.map(({ etiqueta, clientes }) => ({ etiqueta, clientes }))).toEqual([
      { etiqueta: "Anuncio «Jeans»", clientes: 2 },
      { etiqueta: "Anuncio «Chaquetas»", clientes: 1 },
    ]);
  });

  it("dos anuncios con el mismo título pero distinto id se cuentan aparte", () => {
    const conteo = contarPorOrigen([
      { tipo: "anuncio", id: "A1", titulo: "Jeans" },
      { tipo: "anuncio", id: "A2", titulo: "Jeans" },
    ]);
    expect(conteo).toHaveLength(2);
    expect(new Set(conteo.map((c) => c.clave)).size).toBe(2);
  });
});
