/**
 * Portal · Conversaciones: bandeja de chats del negocio (desde `sesiones`).
 * Requiere la policy `sesiones_own` (migración 0002).
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { ConversacionesInbox, type Chat } from "./inbox";
import { enAtencionHumana } from "@/core/engine/atencion-humana";
import { textos } from "@/textos";

export const dynamic = "force-dynamic";

interface SesionRow {
  contact: string;
  channel: string;
  updated_at: string;
  history: { role: "user" | "assistant"; text: string; timestamp?: string }[];
}

export default async function ConversacionesPage({
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

  const { data: sesiones } = await supabase
    .from("sesiones")
    .select("contact, channel, updated_at, history")
    .eq("business_slug", slug)
    .order("updated_at", { ascending: false })
    .limit(50);

  // T-155: qué chats está atendiendo la dueña. Consulta aparte: sin la
  // migración 0033 falla solo esta y la bandeja se ve igual que antes.
  const contactos = ((sesiones ?? []) as SesionRow[]).map((s) => s.contact);
  const { data: atenciones } = contactos.length
    ? await supabase
        .from("leads")
        .select("contact, atencion_humana_desde")
        .eq("business_slug", slug)
        .in("contact", contactos)
        .not("atencion_humana_desde", "is", null)
    : { data: [] };
  const ahora = new Date();
  const atendidos = new Set(
    ((atenciones ?? []) as { contact: string; atencion_humana_desde: string }[])
      .filter((a) => enAtencionHumana({ atencionHumanaDesde: a.atencion_humana_desde }, ahora))
      .map((a) => a.contact),
  );

  const chats: Chat[] = ((sesiones ?? []) as SesionRow[]).map((s) => ({
    contact: s.contact,
    channel: s.channel,
    updatedAt: s.updated_at,
    history: Array.isArray(s.history) ? s.history : [],
    atencionHumana: atendidos.has(s.contact),
  }));

  return (
    <ConversacionesInbox
      chats={chats}
      slug={slug}
      botName={config?.personas?.whatsapp?.name ?? "Asistente"}
      botActivo={config?.botActivo !== false}
    />
  );
}

// T-71: el nombre de la pestaña ("Conversaciones · Aurela"); la plantilla vive en el layout raíz.
export const metadata = { title: textos.portal.titulosPestana.conversaciones };
