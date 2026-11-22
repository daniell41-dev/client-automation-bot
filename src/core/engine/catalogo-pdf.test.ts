import { describe, expect, it } from "vitest";
import { mensajeCatalogo, pideCatalogo, TEXTO_CATALOGO } from "@/core/engine/catalogo-pdf";
import { esteticaBella } from "@/businesses/estetica-bella/config";
import type { BusinessConfig } from "@/core/types";

const URL_PDF = "https://x.supabase.co/storage/v1/object/public/catalogos/n/catalogo-1.pdf";

function config(enviarAlSaludar: boolean): BusinessConfig {
  return { ...esteticaBella, catalogoPdf: { url: URL_PDF, nombreArchivo: "Catálogo Jeans 2026.pdf", enviarAlSaludar } };
}

describe("pideCatalogo (T-121)", () => {
  it("reconoce el pedido con o sin tilde, en singular o plural", () => {
    expect(pideCatalogo("¿Me mandas el catálogo?")).toBe(true);
    expect(pideCatalogo("catalogo porfa")).toBe(true);
    expect(pideCatalogo("TIENEN CATÁLOGOS")).toBe(true);
  });

  it("no confunde otras palabras", () => {
    expect(pideCatalogo("hola, quiero unos jeans")).toBe(false);
    expect(pideCatalogo("catalogación")).toBe(false);
  });
});

describe("mensajeCatalogo (T-121)", () => {
  it("con el interruptor prendido, sale en el primer mensaje del cliente", () => {
    expect(mensajeCatalogo(config(true), "573001", "hola", true)).toEqual({
      to: "573001",
      text: TEXTO_CATALOGO,
      documento: { url: URL_PDF, nombreArchivo: "Catálogo Jeans 2026.pdf" },
    });
  });

  it("no se repite en los mensajes siguientes si no lo piden", () => {
    expect(mensajeCatalogo(config(true), "573001", "quiero la talla 32", false)).toBeNull();
  });

  it("con el interruptor apagado, no sale al saludar pero sí cuando lo piden", () => {
    expect(mensajeCatalogo(config(false), "573001", "hola", true)).toBeNull();
    expect(mensajeCatalogo(config(false), "573001", "me pasas el catálogo?", false)?.documento?.url).toBe(URL_PDF);
  });

  it("sin catálogo cargado nunca manda nada", () => {
    expect(mensajeCatalogo(esteticaBella, "573001", "el catálogo", true)).toBeNull();
  });

  it("le agrega .pdf al nombre si la dueña no lo puso", () => {
    const c = { ...config(true), catalogoPdf: { url: URL_PDF, nombreArchivo: "Catálogo 2026", enviarAlSaludar: true } };
    expect(mensajeCatalogo(c, "573001", "hola", true)?.documento?.nombreArchivo).toBe("Catálogo 2026.pdf");
  });
});
