/**
 * T-89: robots, sitemap y la imagen para redes salen de la configuración, no
 * de un dominio escrito a mano.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import OpengraphImage, { alt, size, contentType } from "@/app/opengraph-image";
import { TITULO_HERO } from "@/components/landing/hero";

const antes = process.env.NEXT_PUBLIC_SITE_URL;

describe("robots y sitemap desde NEXT_PUBLIC_SITE_URL", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://ejemplo.test/";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = antes;
  });

  it("robots apunta al sitemap del sitio configurado y no deja indexar lo privado", async () => {
    const r = await robots();
    expect(r.sitemap).toBe("https://ejemplo.test/sitemap.xml");
    expect(JSON.stringify(r.rules)).toContain("/portal");
  });

  it("todas las URLs del sitemap son del sitio configurado", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u.startsWith("https://ejemplo.test/")).toBe(true);
  });
});

describe("opengraph-image (generada con código)", () => {
  it("1200×630 PNG, con el título del hero como texto alternativo", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(alt).toBe(`Nexo: ${TITULO_HERO}`);
  });

  it("se genera de verdad (fuentes y JSX válidos para ImageResponse)", async () => {
    const respuesta = await OpengraphImage();
    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    // Firma de PNG: 89 50 4E 47.
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 30_000);
});
