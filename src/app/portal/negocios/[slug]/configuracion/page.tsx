/**
 * Portal · Configuración: datos del negocio (nombre, rubro, WhatsApp,
 * dirección) y el bot (nombre + tono de las respuestas).
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { ConfiguracionEditor } from "./configuracion-editor";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createUserClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("config, whatsapp_phone_number_id, rubros(nombre)")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);
  if (!config) notFound();

  return (
    <ConfiguracionEditor
      slug={slug}
      nombre={config.name}
      rubro={(negocio.rubros as unknown as { nombre: string } | null)?.nombre ?? "Negocio"}
      whatsappId={negocio.whatsapp_phone_number_id ?? ""}
      direccion={config.direccion ?? ""}
      persona={
        config.personas?.whatsapp ?? {
          name: "Asistente",
          tone: "",
          language: "español informal",
        }
      }
      personas={config.personas}
    />
  );
}
