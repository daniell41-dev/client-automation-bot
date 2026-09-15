/**
 * Portal · Catálogo/Menú: editor de ítems con preview de WhatsApp en vivo.
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { createInventoryRepository } from "@/core/storage/factory";
import { CatalogoEditor } from "./catalogo-editor";

export const dynamic = "force-dynamic";

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createUserClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id, config, rubros(nombre)")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);
  if (!config) notFound();

  const rubro =
    (negocio.rubros as unknown as { nombre: string } | null)?.nombre ?? "";

  // T-22.3: el stock que ve el dueño acá es el EN VIVO (lo que ya descontaron
  // las ventas), no el número viejo guardado en `negocios.config` — sin esto,
  // abrir el catálogo y guardar sin tocar el stock lo pisaría de vuelta al
  // valor de antes de vender.
  const stockEnVivo = negocio.id ? await createInventoryRepository().getStock(negocio.id) : {};
  const services = config.services.map((s) =>
    s.id in stockEnVivo ? { ...s, stock: stockEnVivo[s.id] } : s,
  );

  return (
    <CatalogoEditor
      slug={slug}
      rubro={rubro}
      catalogo={config.catalogo}
      initialServices={services}
      currency={config.currency}
      locale={config.locale ?? "es-CO"}
      botName={config.personas?.whatsapp?.name ?? "Asistente"}
      botActivo={config.botActivo !== false}
    />
  );
}
