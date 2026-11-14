/**
 * T-90: Clarity solo en la landing, solo con ID y solo con permiso. Lo que el
 * navegador hace después de "Aceptar" (cargar el script y mandar eventos) se
 * prueba a mano con el PR; aquí, lo que se puede asegurar desde el servidor.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import Privacidad from "@/app/privacidad/page";
import { RUTAS_SIN_MEDICION } from "@/lib/medicion";

const APP = __dirname;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });
}

const tocaMedicion = (ruta: string) => /aviso-medicion|clarity/i.test(readFileSync(ruta, "utf8"));

async function landingCon(id: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CLARITY_ID", id ?? "");
  const { default: Home } = await import("@/app/page");
  return renderToStaticMarkup(createElement(Home));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dónde va la medición", () => {
  it.each(RUTAS_SIN_MEDICION)("nada de %s importa el aviso ni Clarity", (ruta) => {
    const dir = join(APP, ruta.slice(1));
    const tocan = archivos(dir).filter(tocaMedicion);
    expect(tocan).toEqual([]);
  });

  it("ni el layout raíz (que comparten todas las rutas)", () => {
    expect(tocaMedicion(join(APP, "layout.tsx"))).toBe(false);
  });

  it("la única página que monta el aviso es la landing", () => {
    const paginas = archivos(APP).filter((r) => r.endsWith("page.tsx") && /aviso-medicion/.test(readFileSync(r, "utf8")));
    expect(paginas).toEqual([join(APP, "page.tsx")]);
  });
});

describe("sin aceptación no sale ningún script", () => {
  it("sin ID: ni aviso ni rastro de Clarity en el HTML", async () => {
    const html = await landingCon(undefined);
    expect(html).not.toMatch(/clarity/i);
    expect(html).not.toContain("Aviso de medición");
  });

  it("con ID: el HTML del servidor tampoco trae el script (se decide en el navegador)", async () => {
    const html = await landingCon("abc123xyz");
    expect(html).not.toMatch(/clarity\.ms/i);
    expect(html).not.toContain("<script async");
  });

  it("un ID mal copiado cuenta como sin ID", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CLARITY_ID", "https://otro.test/x.js");
    const { CLARITY_ID } = await import("@/app/landing-config");
    expect(CLARITY_ID).toBeNull();
  });
});

describe("política de privacidad", () => {
  const html = renderToStaticMarkup(createElement(Privacidad));

  it("nombra la herramienta, su finalidad y que es con aceptación", () => {
    expect(html).toContain('id="medicion"');
    expect(html).toContain("Microsoft Clarity");
    expect(html).toContain("ver cómo se usa la página y mejorarla");
    expect(html).toContain("No, gracias");
  });

  it("ya no dice que no hay cookies de seguimiento", () => {
    expect(html).not.toContain("ni de seguimiento");
  });
});
