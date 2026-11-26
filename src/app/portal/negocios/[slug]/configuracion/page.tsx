/**
 * Portal · Configuración: datos del negocio (nombre, rubro, WhatsApp,
 * dirección) y el bot (nombre, tono, cerebro con IA y el conocimiento del
 * negocio — T-17: se movió acá desde "Respuestas y flujos", oculta desde T-16).
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { candidatosSeguimiento, describirPedido } from "@/core/engine/seguimientos";
import { createLeadRepository } from "@/core/storage/factory";
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
    .select("id, config, whatsapp_phone_number_id, rubros(nombre)")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);
  if (!config) notFound();

  // T-114 (temporal): clientes a los que se les puede mandar el seguimiento a
  // mano. Si la base falla, la página carga igual, sin la lista.
  const ahora = new Date();
  const candidatos = await createLeadRepository(config, negocio.id)
    .list(config.slug)
    .then((leads) =>
      candidatosSeguimiento(leads, config, ahora).map((l) => ({
        id: l.id,
        etiqueta: `${l.name?.trim() || "Sin nombre"} · …${l.contact.slice(-4)} · ${describirPedido(l, config)}`,
      })),
    )
    .catch(() => []);

  return (
    <ConfiguracionEditor
      slug={slug}
      nombre={config.name}
      rubro={(negocio.rubros as unknown as { nombre: string } | null)?.nombre ?? "Negocio"}
      whatsappId={negocio.whatsapp_phone_number_id ?? ""}
      direccion={config.direccion ?? ""}
      notifyPhoneNumber={config.notifyPhoneNumber ?? ""}
      persona={
        config.personas?.whatsapp ?? {
          name: "Asistente",
          tone: "",
          language: "español de Colombia, trato de usted",
        }
      }
      personas={config.personas}
      initialAi={config.ai ?? { enabled: true }}
      initialPagos={config.pagos}
      initialAvisos={config.avisos}
      catalogoPdf={config.catalogoPdf}
      initialSeguimientos={config.seguimientos}
      initialCatalogo={config.catalogo}
      initialResumenDiario={config.resumenDiario}
      candidatosSeguimiento={candidatos}
    />
  );
}

// T-71: el nombre de la pestaña ("Configuración · Aurela"); la plantilla vive en el layout raíz.
export const metadata = { title: "Configuración" };
