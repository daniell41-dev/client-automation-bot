"use client";

/**
 * Panel en vivo (T-38c): cuando entra o cambia un pedido del negocio, la
 * página se vuelve a pedir al servidor. Se recarga entera en vez de aplicar
 * el cambio a mano en el cliente: así el panel nunca muestra un estado que
 * el servidor no calculó (columnas, señales, fotos firmadas).
 *
 * Realtime respeta RLS: la dueña solo recibe eventos de sus pedidos.
 *
 * T-76: el aviso en vivo no alcanza solo. En la prueba real, un pedido
 * rechazado con devolución no aparecía en "Devoluciones" hasta recargar a
 * mano. Un aviso de Realtime se puede perder: el celular suspende la pestaña,
 * se corta el wifi, el canal se reconecta. Por eso el panel también se
 * refresca cuando la dueña vuelve a la pestaña, cuando el canal se reconecta
 * (lo que pasó mientras estaba caído no llega como aviso) y, de respaldo,
 * cada 30 segundos mientras la pestaña está a la vista. Es una consulta
 * liviana, y es la pantalla que se mira en los días de más pedidos.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/** Respaldo por si se pierde un aviso; con la pestaña oculta no corre. */
const REFRESCO_RESPALDO_MS = 30_000;

export function PanelEnVivo({ negocioId }: { negocioId: string }) {
  const router = useRouter();

  useEffect(() => {
    // Varios cambios seguidos (rechazar el pedido + pedir la cuenta de
    // devolución) se juntan en una sola recarga.
    let pendiente: ReturnType<typeof setTimeout> | undefined;
    const refrescar = () => {
      clearTimeout(pendiente);
      pendiente = setTimeout(() => router.refresh(), 500);
    };
    const visible = () => document.visibilityState === "visible";

    const alVolver = () => {
      if (visible()) refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    const respaldo = setInterval(() => {
      if (visible()) router.refresh();
    }, REFRESCO_RESPALDO_MS);

    const supabase = createBrowserSupabase();
    let conectadoAntes = false;
    const canal = supabase
      ?.channel(`pedidos-${negocioId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `negocio_id=eq.${negocioId}` },
        refrescar,
      )
      .subscribe((estado) => {
        // La primera conexión no necesita refresco (la página recién se
        // cargó); una reconexión sí: lo que cambió mientras tanto no avisa.
        if (estado === "SUBSCRIBED") {
          if (conectadoAntes) refrescar();
          conectadoAntes = true;
        }
      });

    return () => {
      clearTimeout(pendiente);
      clearInterval(respaldo);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      if (supabase && canal) void supabase.removeChannel(canal);
    };
  }, [negocioId, router]);

  return null;
}
