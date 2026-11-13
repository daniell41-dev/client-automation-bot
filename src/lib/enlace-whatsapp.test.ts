import { describe, expect, it } from "vitest";
import { enlaceInstagram, enlaceWhatsApp, MENSAJES_WHATSAPP, type OrigenWhatsApp } from "@/lib/enlace-whatsapp";

const NUMERO = "573001234567";

describe("enlaceWhatsApp (T-80)", () => {
  it("arma el enlace de wa.me con el número y el mensaje del botón", () => {
    const url = new URL(enlaceWhatsApp("hero", NUMERO));
    expect(url.origin + url.pathname).toBe(`https://wa.me/${NUMERO}`);
    expect(url.searchParams.get("text")).toBe(MENSAJES_WHATSAPP.hero);
  });

  it("cada botón manda un mensaje distinto, para saber desde qué parte escriben", () => {
    const origenes = Object.keys(MENSAJES_WHATSAPP) as OrigenWhatsApp[];
    expect(origenes).toEqual(expect.arrayContaining(["hero", "precios", "barra-movil", "cierre"]));
    const textos = origenes.map((o) => new URL(enlaceWhatsApp(o, NUMERO)).searchParams.get("text"));
    expect(new Set(textos).size).toBe(origenes.length);
  });

  it("codifica el mensaje: tildes y signos no rompen el enlace", () => {
    expect(enlaceWhatsApp("precios", NUMERO)).not.toMatch(/[ ¿ñáéíóú]/);
  });

  it("acepta el número con espacios, + o guiones", () => {
    expect(enlaceWhatsApp("hero", "+57 300 123-4567")).toContain(`wa.me/${NUMERO}?`);
  });

  it("sin número, o con uno que no es colombiano, lleva a la demo", () => {
    expect(enlaceWhatsApp("hero", undefined)).toBe("/demo");
    expect(enlaceWhatsApp("hero", "")).toBe("/demo");
    expect(enlaceWhatsApp("cierre", "3001234567")).toBe("/demo"); // falta el 57
    expect(enlaceWhatsApp("cierre", "5730012345")).toBe("/demo"); // incompleto
  });
});

describe("enlaceInstagram (T-80)", () => {
  it("acepta el usuario con o sin @, o la URL completa", () => {
    expect(enlaceInstagram("nexo.cucuta")).toBe("https://www.instagram.com/nexo.cucuta");
    expect(enlaceInstagram("@nexo.cucuta")).toBe("https://www.instagram.com/nexo.cucuta");
    expect(enlaceInstagram("https://instagram.com/nexo.cucuta")).toBe("https://instagram.com/nexo.cucuta");
  });

  it("sin configurar, no hay enlace (el pie no lo muestra)", () => {
    expect(enlaceInstagram(undefined)).toBeNull();
    expect(enlaceInstagram("  ")).toBeNull();
  });
});
