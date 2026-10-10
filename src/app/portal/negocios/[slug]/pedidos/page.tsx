/**
 * Portal · Pedidos (T-38): el panel de la dueña para los días pico.
 *
 * Muestra los pedidos abiertos por columna (por verificar → en preparación →
 * listo → entregado) y los entregados del último día. Se lee con el cliente
 * de la dueña: RLS (`pedidos_own`) garantiza que solo ve los suyos.
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { toPedido } from "@/core/storage/adapters/supabase/pedidos";
import type { PedidoRow } from "@/core/storage/adapters/supabase/api";
import { armarPanel } from "@/core/engine/panel-pedidos";
import { PedidosPanel, type SeñalesPorPedido } from "./pedidos-panel";

export const dynamic = "force-dynamic";

const ESTADOS_ABIERTOS = ["esperando_pago", "por_verificar", "aprobado", "listo"];

/** Los entregados se muestran solo un día: el panel es para hoy, no un historial. */
function haceUnDia(ahora: Date): string {
  return new Date(ahora.getTime() - 24 * 3_600_000).toISOString();
}

export default async function PedidosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createUserClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id, config")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);
  if (!config) notFound();

  const desde = haceUnDia(new Date());
  const [{ data: abiertos }, { data: entregados }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("*, comprobantes(*)")
      .eq("negocio_id", negocio.id)
      .in("estado", ESTADOS_ABIERTOS)
      .order("numero", { ascending: true })
      .limit(200),
    supabase
      .from("pedidos")
      .select("*, comprobantes(*)")
      .eq("negocio_id", negocio.id)
      .eq("estado", "entregado")
      .gte("updated_at", desde)
      .order("numero", { ascending: false })
      .limit(30),
  ]);

  const filas = [...(abiertos ?? []), ...(entregados ?? [])] as unknown as (PedidoRow & {
    comprobantes: {
      señales: { detalle: string; nivel: string }[] | null;
      imagen_path: string | null;
    } | null;
  })[];
  const señales: SeñalesPorPedido = Object.fromEntries(
    filas.map((f) => [f.id, (f.comprobantes?.señales ?? []).map((s) => ({ detalle: s.detalle, nivel: s.nivel }))]),
  );

  // T-38b: la foto del comprobante, con una URL firmada que vence en una
  // hora — el bucket es privado y la política solo deja firmar las de los
  // negocios de esta dueña.
  const fotos: Record<string, string> = {};
  await Promise.all(
    filas
      .filter((f) => f.comprobantes?.imagen_path)
      .map(async (f) => {
        const { data } = await supabase.storage
          .from("comprobantes")
          .createSignedUrl(f.comprobantes!.imagen_path!, 3600);
        if (data?.signedUrl) fotos[f.id] = data.signedUrl;
      }),
  );

  return (
    <PedidosPanel
      fotos={fotos}
      slug={slug}
      moneda={config.currency}
      locale={config.locale ?? "es-CO"}
      panel={armarPanel(filas.map(toPedido))}
      señales={señales}
    />
  );
}
