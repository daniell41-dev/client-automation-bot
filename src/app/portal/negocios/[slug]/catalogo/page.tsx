/**
 * Portal · Catálogo/Menú: editor de ítems con preview de WhatsApp en vivo.
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
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
    .select("config, rubros(nombre)")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);
  if (!config) notFound();

  const rubro =
    (negocio.rubros as unknown as { nombre: string } | null)?.nombre ?? "";

  return (
    <CatalogoEditor
      slug={slug}
      rubro={rubro}
      initialServices={config.services}
      currency={config.currency}
      locale={config.locale ?? "es-CO"}
      botName={config.personas?.whatsapp?.name ?? "Asistente"}
      botActivo={config.botActivo !== false}
    />
  );
}
