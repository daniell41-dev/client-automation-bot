import { describe, expect, it } from "vitest";
import { enlaceInstagram, enlaceWhatsApp, ETIQUETAS_WHATSAPP, MENSAJES_WHATSAPP, type OrigenWhatsApp } from "@/lib/enlace-whatsapp";

const NUMERO = "573001234567";

describe("enlaceWhatsApp (T-80)", () => {
  it("arma el enlace de wa.me con el número y el mensaje del botón", () => {
    const url = new URL(enlaceWhatsApp("hero", NUMERO));
    expect(url.origin + url.pathname).toBe(`https://wa.me/${NUMERO}`);
    expect(url.searchParams.get("text")).toBe(MENSAJES_WHATSAPP.hero);
  });

  it("cada botón manda un mensaje distinto, para saber desde qué parte escriben", () => {
    const origenes = Object.keys(MENSAJES_WHATSAPP) as OrigenWhatsApp[];
    expect(origenes).toEqual(expect.arrayContaining(["hero", "precios", "barra-movil", "cierre", "comprobante"]));
    const textos = origenes.map((o) => new URL(enlaceWhatsApp(o, NUMERO)).searchParams.get("text"));
    expect(new Set(textos).size).toBe(origenes.length);
  });

  it("cada botón tiene su propio texto, corto y que dice qué va a pasar", () => {
    const origenes = Object.keys(MENSAJES_WHATSAPP) as OrigenWhatsApp[];
    expect(Object.keys(ETIQUETAS_WHATSAPP).sort()).toEqual([...origenes].sort());
    const etiquetas = origenes.map((o) => ETIQUETAS_WHATSAPP[o]);
    expect(new Set(etiquetas).size).toBe(origenes.length);
    // Cortos: tienen que caber en una línea en el botón de un celular de 320 px
    // (medido: 25 caracteres caben; 28 ya se parten en dos líneas).
    for (const e of etiquetas) expect(e.length, e).toBeLessThanOrEqual(25);
    // Uno solo genérico: el de la barra fija del celular, que acompaña toda la página.
    expect(etiquetas.filter((e) => e === "Escríbanos por WhatsApp")).toEqual(["Escríbanos por WhatsApp"]);
    expect(ETIQUETAS_WHATSAPP["barra-movil"]).toBe("Escríbanos por WhatsApp");
  });

  it("T-83: el botón del comprobante pregunta por la revisión de comprobantes", () => {
    const url = new URL(enlaceWhatsApp("comprobante", NUMERO));
    expect(url.searchParams.get("text")).toBe("Hola, quiero saber cómo Aurela revisa los comprobantes.");
    expect(enlaceWhatsApp("comprobante", undefined)).toBe("/demo");
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
