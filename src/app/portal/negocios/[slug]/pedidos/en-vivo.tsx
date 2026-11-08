"use client";

/**
 * Panel en vivo (T-38c): cuando entra o cambia un pedido del negocio, la
 * página se vuelve a pedir al servidor. Se recarga entera en vez de aplicar
 * el cambio a mano en el cliente: así el panel nunca muestra un estado que
 * el servidor no calculó (columnas, señales, fotos firmadas).
 *
 * Realtime respeta RLS: la dueña solo recibe eventos de sus pedidos.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function PanelEnVivo({ negocioId }: { negocioId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    // Varios cambios seguidos (crear pedido + vincular comprobante) se
    // juntan en una sola recarga.
    let pendiente: ReturnType<typeof setTimeout> | undefined;
    const canal = supabase
      .channel(`pedidos-${negocioId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `negocio_id=eq.${negocioId}` },
        () => {
          clearTimeout(pendiente);
          pendiente = setTimeout(() => router.refresh(), 500);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(pendiente);
      void supabase.removeChannel(canal);
    };
  }, [negocioId, router]);

  return null;
}
