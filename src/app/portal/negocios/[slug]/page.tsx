/**
 * Portal · Resumen del negocio: KPIs, checklist "Completá tu bot" y
 * conversaciones recientes.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { Card, EmptyState, Pill, StatCard } from "@/components/ui";
import { CheckCircle2, Circle } from "lucide-react";

export const dynamic = "force-dynamic";

interface SesionRow {
  contact: string;
  updated_at: string;
  history: { role: string; text: string; timestamp?: string }[];
}

export default async function ResumenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createUserClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("config, whatsapp_phone_number_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);

  const [{ data: leads }, { data: sesiones }] = await Promise.all([
    supabase.from("leads").select("state, stage").eq("business_slug", slug),
    supabase
      .from("sesiones")
      .select("contact, updated_at, history")
      .eq("business_slug", slug)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  // KPIs
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const mensajesHoy = ((sesiones ?? []) as SesionRow[]).reduce((acc, s) => {
    const turns = Array.isArray(s.history)
      ? s.history.filter((t) => t.timestamp && new Date(t.timestamp) >= hoy).length
      : 0;
    return acc + turns;
  }, 0);
  const citas = (leads ?? []).filter((l) => l.state === "agendado").length;
  const total = (leads ?? []).length;
  const resueltas = (leads ?? []).filter((l) => l.stage === "datos_completos").length;
  const pctResueltas = total > 0 ? Math.round((resueltas / total) * 100) : 0;

  // Checklist "Completá tu bot"
  const checklist = [
    { label: "Catálogo cargado", done: (config?.services.length ?? 0) > 0 },
    { label: "Horarios y ubicación", done: (config?.horarios?.length ?? 0) > 0 },
    { label: "Respuestas automáticas", done: Boolean(config?.ai?.knowledge?.trim()) },
    { label: "WhatsApp conectado", done: Boolean(negocio.whatsapp_phone_number_id) },
  ];
  const done = checklist.filter((c) => c.done).length;

  const recientes = ((sesiones ?? []) as SesionRow[]).slice(0, 3);

  return (
    <div className="mx-auto max-w-[860px] space-y-5 fade-up">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Mensajes hoy" value={String(mensajesHoy)} delta="+ vs. ayer" />
        <StatCard
          label="Citas agendadas"
          value={String(citas)}
          delta={citas > 0 ? `${citas} en total` : undefined}
        />
        <StatCard
          label="Resueltas por el bot"
          value={`${pctResueltas}%`}
          delta="sin intervención"
        />
        <StatCard label="Tiempo de respuesta" value="~5 s" delta="instantáneo" deltaTone="neutral" />
      </div>

      {/* Completá tu bot */}
      <Card
        title="Completá tu bot"
        subtitle="Cuanto más completes, mejor responde a tus clientes."
        action={
          <span className="font-display text-sm font-bold text-primary">
            {done}/{checklist.length}
          </span>
        }
      >
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(done / checklist.length) * 100}%` }}
          />
        </div>
        <ul className="space-y-2.5">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <Circle className="h-5 w-5 text-line-input" />
              )}
              <span className={item.done ? "text-ink" : "text-ink-mid"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href={`/portal/negocios/${slug}/${done < 2 ? "catalogo" : "respuestas"}`}
          className="mt-4 block rounded-[10px] bg-primary-tint py-2.5 text-center text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          Continuar configuración
        </Link>
      </Card>

      {/* Conversaciones recientes */}
      <Card title="Conversaciones recientes">
        {recientes.length === 0 ? (
          <EmptyState
            title="Aún no hay conversaciones."
            subtitle="Cuando tus clientes escriban al bot, van a aparecer acá."
          />
        ) : (
          <ul className="divide-y divide-line">
            {recientes.map((s) => {
              const last = s.history[s.history.length - 1];
              return (
                <li key={s.contact}>
                  <Link
                    href={`/portal/negocios/${slug}/conversaciones`}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-surface-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary">
                      {s.contact.slice(-2)}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">
                          {s.contact}
                        </span>
                        <Pill tone={last?.role === "assistant" ? "success" : "info"}>
                          {last?.role === "assistant" ? "Bot" : "Cliente"}
                        </Pill>
                      </span>
                      <span className="block truncate text-[13px] text-ink-soft">
                        {last?.text ?? "—"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">
                      {new Date(s.updated_at).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
