/**
 * Portal · Conversaciones: bandeja de chats del negocio (desde `sesiones`).
 * Requiere la policy `sesiones_own` (migración 0002).
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { ConversacionesInbox, type Chat } from "./inbox";

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

  const chats: Chat[] = ((sesiones ?? []) as SesionRow[]).map((s) => ({
    contact: s.contact,
    updatedAt: s.updated_at,
    history: Array.isArray(s.history) ? s.history : [],
  }));

  return (
    <ConversacionesInbox
      chats={chats}
      botName={config?.personas?.whatsapp?.name ?? "Asistente"}
      botActivo={config?.botActivo !== false}
    />
  );
}
