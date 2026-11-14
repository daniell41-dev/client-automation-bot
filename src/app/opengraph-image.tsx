/**
 * T-89: la imagen que muestran WhatsApp, Facebook y los buscadores al
 * compartir el link de Nexo, generada con código (convención
 * `opengraph-image.tsx`) en vez de un PNG fijo. Así sale del mismo título del
 * hero y del mismo PRECIO_DESDE que la página: si cambian allá, cambia aquí
 * en el próximo build, sin rehacer una imagen a mano.
 *
 * Se genera al compilar (no usa datos de la request). No lleva dominio
 * escrito: la URL ya la muestra cada red al lado de la imagen.
 *
 * Fuentes: las mismas de la marca, pero en .woff (ImageResponse no lee woff2).
 * Viven en src/app/fonts/og/ y solo se usan aquí.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PRECIO_DESDE } from "@/app/landing-config";
import { TITULO_HERO } from "@/components/landing/hero";

export const alt = `Nexo: ${TITULO_HERO}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const carpeta = join(process.cwd(), "src/app/fonts/og");

/** Glifo del logo (burbuja de chat de lucide, el mismo de `components/logo.tsx`), relleno. */
const BURBUJA =
  "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719";

export default async function Image() {
  const [jakarta800, jakarta700, sora700] = await Promise.all([
    readFile(join(carpeta, "plus-jakarta-sans-800.woff")),
    readFile(join(carpeta, "plus-jakarta-sans-700.woff")),
    readFile(join(carpeta, "sora-700.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(80% 70% at 50% 0%, rgba(42,111,219,0.35) 0%, rgba(14,32,51,0) 60%), #0E2033",
          fontFamily: "Jakarta",
          color: "#ffffff",
        }}
      >
        {/* Logo: tile azul con la burbuja + "Nexo" */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#2a6fdb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24">
              <path d={BURBUJA} fill="#ffffff" />
            </svg>
          </div>
          <span style={{ fontSize: 40, fontWeight: 800 }}>Nexo</span>
        </div>

        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.5, maxWidth: 1000 }}>
          {TITULO_HERO}
        </div>

        {PRECIO_DESDE ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, fontSize: 34, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
            <span>Desde</span>
            <span style={{ fontFamily: "Sora", fontSize: 52, color: "#ffffff" }}>{PRECIO_DESDE}</span>
            <span>al mes · Instalación gratis</span>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
            Pedidos, citas y revisión de pagos por WhatsApp
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: jakarta800, weight: 800, style: "normal" },
        { name: "Jakarta", data: jakarta700, weight: 700, style: "normal" },
        { name: "Sora", data: sora700, weight: 700, style: "normal" },
      ],
    },
  );
}
