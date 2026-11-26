import { describe, expect, it } from "vitest";
import { formato, textos } from "@/textos";

/** Todas las hojas del JSON, con su ruta ("portal.menu.panel"). */
function hojas(obj: unknown, ruta = ""): [string, unknown][] {
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) => hojas(v, ruta ? `${ruta}.${k}` : k));
  }
  return [[ruta, obj]];
}

describe("textos (T-130)", () => {
  it("formato rellena los huecos y deja a la vista el que no tiene valor", () => {
    expect(formato("Panorama del asistente en {negocio}", { negocio: "Sabores" })).toBe(
      "Panorama del asistente en Sabores",
    );
    expect(formato("{n} pedidos", { n: 3 })).toBe("3 pedidos");
    expect(formato("Hola {nombre}", {})).toBe("Hola {nombre}");
  });

  it("todos los textos son frases no vacías", () => {
    for (const [ruta, valor] of hojas(textos)) {
      expect(typeof valor, ruta).toBe("string");
      expect((valor as string).trim().length, ruta).toBeGreaterThan(0);
    }
  });

  it("ningún texto dice «bot» (T-129: se dice «asistente»), y «botón» sí vale", () => {
    expect("Se guarda con el botón de abajo").not.toMatch(/(?<!\p{L})bots?(?!\p{L})/iu);
    expect("Pausar bot").toMatch(/(?<!\p{L})bots?(?!\p{L})/iu);
    for (const [ruta, valor] of hojas(textos)) {
      // Con \p{L} y no \b: para \b la "ó" de "botón" corta la palabra.
      expect(String(valor), ruta).not.toMatch(/(?<!\p{L})bots?(?!\p{L})/iu);
    }
  });
});
