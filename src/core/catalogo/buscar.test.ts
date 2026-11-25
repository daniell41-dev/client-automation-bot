/**
 * T-118: buscador de productos para catálogos grandes. El catálogo de prueba
 * imita al del primer mayorista (jeans por categoría y tono, referencias tipo
 * "B203", tallas 6 a 16 en todos) con datos inventados.
 */
import { describe, expect, it } from "vitest";
import { buscarProductos, recortarDescripcion, UMBRAL_CATALOGO_GRANDE } from "@/core/catalogo/buscar";
import { runAgentTurn } from "@/core/ai/agent";
import { buildAgentSystemPrompt } from "@/core/ai/agent-prompt";
import type { AgentTurnInput } from "@/core/ai/provider";
import type { BusinessConfig, Service } from "@/core/types";

const CATEGORIAS = ["Skinny", "Short", "Short Torero", "Falda Short", "Overol Mono"];
const TONOS = ["azul claro", "azul hielo", "azul indigo", "negro", "gris"];
const TALLAS = { nombre: "Talla", opciones: ["6", "8", "10", "12", "14", "16"] };

const catalogo: Service[] = CATEGORIAS.flatMap((cat, i) =>
  TONOS.flatMap((tono, j) =>
    [0, 1].map((k) => {
      const ref = `B${200 + i * 20 + j * 2 + k}`;
      return {
        id: `ref-${ref.toLowerCase()}`,
        name: `${cat} dama jean stretch tiro alto ${k ? "rotos" : "clasico"} tono ${tono}`,
        description: "Jean colombiano de excelente calidad, cómodo y moderno, ideal para cualquier ocasión del día.",
        price: 99900 + k * 6000,
        modo: "pedido" as const,
        categoria: cat,
        referencia: ref,
        detalles: [TALLAS],
      };
    }),
  ),
);

describe("buscarProductos", () => {
  it("el catálogo de prueba es grande (pasa el umbral)", () => {
    expect(catalogo.length).toBeGreaterThan(UMBRAL_CATALOGO_GRANDE);
  });

  it("por referencia trae ese producto solo, con o sin la letra", () => {
    expect(buscarProductos(catalogo, { mensaje: "mándeme la B203 en talla 10" }).productos.map((p) => p.referencia)).toEqual(["B203"]);
    expect(buscarProductos(catalogo, { mensaje: "la 203" }).productos.map((p) => p.referencia)).toEqual(["B203"]);
  });

  it("«skinny azul claro» pone primero los skinny azul claro", () => {
    const r = buscarProductos(catalogo, { mensaje: "Skinny azul claro" });
    expect(r.productos.slice(0, 2).every((p) => p.categoria === "Skinny" && p.name.includes("azul claro"))).toBe(true);
    expect(r.productos.length).toBeLessThanOrEqual(12);
    expect(r.sinResultados).toBe(false);
  });

  it("singular y plural, con y sin tilde: «shorts toreros» encuentra Short Torero", () => {
    const r = buscarProductos(catalogo, { mensaje: "tienen shorts toreros?" });
    expect(r.productos[0].categoria).toBe("Short Torero");
  });

  it("toma en cuenta el mensaje anterior: «overol» … «¿y en negro?»", () => {
    const r = buscarProductos(catalogo, { mensaje: "¿y en negro?", anterioresCliente: ["quiero un overol"] });
    expect(r.productos[0]).toMatchObject({ categoria: "Overol Mono" });
    expect(r.productos[0].name).toContain("negro");
  });

  it("«¿qué jeans tienen?» es una pregunta general: «jean» está en todo el catálogo y no elige nada", () => {
    const r = buscarProductos(catalogo, { mensaje: "Hola, ¿qué jeans tienen?" });
    expect(r.productos).toEqual([]);
    expect(r.sinResultados).toBe(false);
  });

  it("un saludo no trae productos pero sí las categorías con su cantidad", () => {
    const r = buscarProductos(catalogo, { mensaje: "Hola, buenas tardes" });
    expect(r.productos).toEqual([]);
    expect(r.categorias[0]).toEqual({ nombre: "Skinny", cantidad: 10 });
    expect(r.sinResultados).toBe(false);
  });

  it("algo concreto que no existe queda marcado sin resultados (para no negar a ciegas y registrarlo)", () => {
    const r = buscarProductos(catalogo, { mensaje: "tienen chaquetas de cuero?" });
    expect(r.sinResultados).toBe(true);
    expect(r.buscado).toContain("chaqueta");
  });

  it("una talla sola no es una búsqueda (está en todos)", () => {
    expect(buscarProductos(catalogo, { mensaje: "talla 10" }).sinResultados).toBe(false);
  });

  it("siempre trae el carrito y lo que el asistente acaba de mostrar («el 2»)", () => {
    const r = buscarProductos(catalogo, {
      mensaje: "el 2 en talla 10",
      anterioresAsistente: ["Tenemos: 1. Ref B200 … 2. Ref B201 …"],
      enCarrito: ["ref-b288"],
    });
    expect(r.productos.map((p) => p.referencia)).toEqual(["B288", "B200", "B201"]);
  });
});

describe("recortarDescripcion", () => {
  it("corta en una palabra y marca con …; lo corto queda igual", () => {
    expect(recortarDescripcion("Corta")).toBe("Corta");
    const r = recortarDescripcion("palabra ".repeat(40));
    expect(r.length).toBeLessThanOrEqual(121);
    expect(r.endsWith("palabra…")).toBe(true);
  });
});

describe("T-118 en el agente", () => {
  const base: BusinessConfig = {
    slug: "jeans",
    name: "Jeans",
    currency: "COP",
    services: catalogo,
    messages: { welcome: "Hola", askName: "¿Nombre?", askDate: "¿Fecha?", askConfirm: "¿Confirma?", serviceInfo: "x", captured: "ok", fallback: "?" },
    followUps: [],
  };
  async function entradaDe(config: BusinessConfig, texto: string): Promise<AgentTurnInput> {
    let capturada: AgentTurnInput | undefined;
    await runAgentTurn(
      null,
      { channel: "mock", businessSlug: config.slug, from: "1", text: texto, timestamp: "2026-11-25T15:00:00.000Z" },
      config,
      {
        enhance: async (c) => c.draftResponse,
        extractDateTime: async () => null,
        interpret: async () => null,
        runAgent: async (input) => {
          capturada = input;
          return { respuesta: "ok", acciones: [] };
        },
      },
      { name: "Ana", tone: "cálida", language: "español" },
      [],
      new Date("2026-11-25T15:00:00.000Z"),
    );
    return capturada!;
  }

  it("con un catálogo grande, la IA ve solo lo que coincide y sabe que hay más", async () => {
    const input = await entradaDe(base, "skinny azul claro");
    expect(input.services.length).toBeLessThanOrEqual(12);
    expect(input.catalogoParcial).toMatchObject({ total: catalogo.length, sinResultados: false });
    const prompt = buildAgentSystemPrompt(input);
    expect(prompt).toContain(`Este negocio tiene ${catalogo.length} productos`);
    expect(prompt).toContain("Skinny (10)");
    expect(prompt).not.toContain("los ÚNICOS que existen");
  });

  it("un negocio chico sigue viendo su catálogo completo, como antes", async () => {
    const chico = { ...base, services: catalogo.slice(0, 5) };
    const input = await entradaDe(chico, "skinny azul claro");
    expect(input.services).toHaveLength(5);
    expect(input.catalogoParcial).toBeUndefined();
    expect(buildAgentSystemPrompt(input)).toContain("los ÚNICOS que existen");
  });

  it("anotar un producto que la IA no tiene a la vista sigue validándose contra el catálogo completo", async () => {
    const r = await runAgentTurn(
      null,
      { channel: "mock", businessSlug: "jeans", from: "1", text: "2 de la B249 talla 8", timestamp: "2026-11-25T15:00:00.000Z" },
      base,
      {
        enhance: async (c) => c.draftResponse,
        extractDateTime: async () => null,
        interpret: async () => null,
        runAgent: async () => ({
          respuesta: "¡Anotado!",
          acciones: [{ tipo: "guardar_cantidad", servicioId: "ref-b249", cantidad: 2, variante: "8" }],
        }),
      },
      { name: "Ana", tone: "cálida", language: "español" },
      [],
      new Date("2026-11-25T15:00:00.000Z"),
    );
    expect(r!.lead.items).toEqual([{ serviceId: "ref-b249", cantidad: 2, variante: "8" }]);
  });
});
