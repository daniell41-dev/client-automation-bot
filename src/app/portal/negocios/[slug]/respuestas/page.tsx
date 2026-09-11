/**
 * Portal · Respuestas y flujos: cerebro con IA (knowledge), reglas rápidas,
 * botones de menú y fallback, con preview en vivo.
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { RespuestasEditor } from "./respuestas-editor";

export const dynamic = "force-dynamic";

export default async function RespuestasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createUserClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("config")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);
  if (!config) notFound();

  return (
    <RespuestasEditor
      slug={slug}
      initialAi={
        config.ai ?? { enabled: true, knowledge: "", reglas: [], botonesMenu: [] }
      }
      messages={config.messages}
      botName={config.personas?.whatsapp?.name ?? "Asistente"}
      botActivo={config.botActivo !== false}
    />
  );
}
