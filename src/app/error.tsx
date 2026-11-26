"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PantallaError, botonPrincipal, botonSecundario } from "@/components/pantalla-error";
import { formato, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (errores.general). */
const tt = textos.errores.general;

/**
 * T-72: un error inesperado en cualquier pantalla. "Intentar de nuevo" sirve
 * para lo pasajero (Supabase tardó, se cortó el internet), que es lo más
 * común. El código (`digest`) es lo que la dueña nos puede mandar: con él se
 * encuentra el error en los logs del servidor sin mostrarle el detalle técnico.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[Pantalla] error inesperado:", error);
  }, [error]);

  return (
    <PantallaError
      codigo={tt.ups}
      titulo={tt.algoSalioMal}
      texto={tt.noPudimosCargarEsta}
      detalle={error.digest ? formato(tt.codigoDelError, { codigo: error.digest }) : undefined}
    >
      <button type="button" onClick={() => retry()} className={botonPrincipal}>{tt.intentarDeNuevo}</button>
      <Link href="/portal" className={botonSecundario}>{tt.irAMisNegocios}</Link>
    </PantallaError>
  );
}
