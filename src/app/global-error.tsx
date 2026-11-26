"use client";

import "./globals.css";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (errores.global). */
const tt = textos.errores.global;

/**
 * T-72: último recurso, cuando falla el propio layout raíz. Reemplaza al
 * layout, así que trae su `<html>` y los estilos; sin esto Next muestra su
 * pantalla en inglés. Se mantiene mínima a propósito: si llegamos acá, algo
 * básico falló y no conviene depender de más piezas.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100vh", background: "#2A0F2E", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <title>{tt.algoSalioMalAurela}</title>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "20vh 24px" }}>
          <p style={{ fontSize: 15, fontWeight: 800, opacity: 0.9 }}>{tt.aurela}</p>
          <h1 style={{ fontSize: 32, margin: "16px 0 8px" }}>{tt.algoSalioMal}</h1>
          <p style={{ opacity: 0.7, lineHeight: 1.6 }}>{tt.noPudimosCargarAurela}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, background: "#6B2475", color: "#fff", border: 0, borderRadius: 10, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}
          >{tt.intentarDeNuevo}</button>
          {error.digest && <p style={{ marginTop: 40, fontSize: 12, opacity: 0.4 }}>{tt.codigoDelError}{error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
