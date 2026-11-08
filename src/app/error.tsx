"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PantallaError, botonPrincipal, botonSecundario } from "@/components/pantalla-error";

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
      codigo="Ups"
      titulo="Algo salió mal"
      texto="No pudimos cargar esta pantalla. Suele ser algo pasajero: probá de nuevo en unos segundos. Tus pedidos y tus datos están bien."
      detalle={error.digest ? `Código del error: ${error.digest}` : undefined}
    >
      <button type="button" onClick={() => retry()} className={botonPrincipal}>
        Intentar de nuevo
      </button>
      <Link href="/portal" className={botonSecundario}>
        Ir a mis negocios
      </Link>
    </PantallaError>
  );
}
