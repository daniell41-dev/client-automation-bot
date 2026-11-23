/**
 * Portal · Resumen del negocio: KPIs, checklist "Completá tu bot" y
 * conversaciones recientes.
 */

import { cuentasDeConfig } from "@/core/engine/datos-pago";
import { contarPorOrigen } from "@/core/engine/origen";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { Card, EmptyState, Pill, StatCard } from "@/components/ui";
import { CheckCircle2, Circle } from "lucide-react";
import { LeTocaAUsted } from "@/components/le-toca-a-usted";
import { armarPendientes, type PedidoInicio } from "@/lib/inicio-portal";

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
    .select("id, config, whatsapp_phone_number_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);

  const [{ data: leads }, { data: sesiones }, { data: conOrigen }, { data: pedidosPendientes }] = await Promise.all([
    supabase.from("leads").select("state, stage").eq("business_slug", slug),
    supabase
      .from("sesiones")
      .select("contact, updated_at, history")
      .eq("business_slug", slug)
      .order("updated_at", { ascending: false })
      .limit(20),
    // T-120: consulta aparte de la de arriba para que, sin la migración
    // 0030, falle solo el conteo por anuncio y no los KPIs.
    supabase.from("leads").select("origen").eq("business_slug", slug).not("origen", "is", null),
    // Lo mismo que "Le toca a usted" del inicio: con un solo negocio la
    // dueña entra directo acá, así que los pendientes tienen que estar arriba.
    supabase
      .from("pedidos")
      .select("negocio_id, numero, cliente, total, monto_pagado, moneda, estado, created_at, devolucion_estado, comprobantes(*)")
      .eq("negocio_id", negocio.id)
      .or("estado.eq.por_verificar,devolucion_estado.in.(pendiente,pidiendo_cuenta)")
      .limit(200),
  ]);
  const pendientes = armarPendientes((pedidosPendientes ?? []) as unknown as PedidoInicio[], [
    { id: negocio.id, slug, nombre: config?.name ?? slug },
  ]);
  const porAnuncio = contarPorOrigen(((conOrigen ?? []) as { origen: unknown }[]).map((l) => l.origen));

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
    // T-42: sin su número, la dueña nunca se entera de un pedido; y si cobra
    // con comprobante, sin datos de pago el bot le pide plata al cliente sin
    // decirle a dónde mandarla.
    { label: "Su WhatsApp para avisos", done: Boolean(config?.notifyPhoneNumber) },
    ...(config?.pagos?.requiereComprobante
      ? [{ label: "Cuentas para cobrar", done: cuentasDeConfig(config.pagos).length > 0 }]
      : []),
    { label: "WhatsApp conectado", done: Boolean(negocio.whatsapp_phone_number_id) },
  ];
  const done = checklist.filter((c) => c.done).length;

  const recientes = ((sesiones ?? []) as SesionRow[]).slice(0, 3);

  return (
    <div className="mx-auto max-w-[860px] space-y-5 fade-up">
      <LeTocaAUsted pendientes={pendientes} />

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
        title="Complete su bot"
        subtitle="Cuanto más completes, mejor responde a sus clientes."
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
        {!negocio.whatsapp_phone_number_id && (
          <p className="mt-3 text-[13px] text-ink-soft">
            El bot queda apagado hasta que el administrador conecte su número de
            WhatsApp. Mientras tanto puede dejar todo listo.
          </p>
        )}
        {/* T-16: "Respuestas y flujos" está oculta — el conocimiento del bot
            se muda a Configuración en T-17, así que apunta ahí de una vez
            en vez de a una ruta que el cliente ya no puede alcanzar. */}
        <Link
          href={`/portal/negocios/${slug}/${done < 2 ? "catalogo" : "configuracion"}`}
          className="mt-4 block rounded-[10px] bg-primary-tint py-2.5 text-center text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          Continuar configuración
        </Link>
      </Card>

      {/* T-120: cuántos clientes trajo cada anuncio. Solo aparece cuando
          hay al menos uno: a quien no pauta no le dice nada. */}
      {porAnuncio.length > 0 && (
        <Card title="Clientes por anuncio" subtitle="Quienes escribieron desde un anuncio o publicación de Facebook o Instagram.">
          <ul className="divide-y divide-line">
            {porAnuncio.map((fila) => (
              <li key={fila.clave} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-ink">{fila.etiqueta}</span>
                <span className="shrink-0 font-bold tabular-nums text-ink">
                  {fila.clientes} {fila.clientes === 1 ? "cliente" : "clientes"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Conversaciones recientes: preview informativo, sin link — la
          sección "Conversaciones" está oculta (T-16). */}
      <Card title="Conversaciones recientes">
        {recientes.length === 0 ? (
          <EmptyState
            title="Aún no hay conversaciones."
            subtitle="Cuando sus clientes escriban al bot, van a aparecer aquí."
          />
        ) : (
          <ul className="divide-y divide-line">
            {recientes.map((s) => {
              const last = s.history[s.history.length - 1];
              return (
                <li key={s.contact} className="flex items-center gap-3 py-3">
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
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

// T-71: el nombre de la pestaña ("Inicio · Aurela"); la plantilla vive en el layout raíz.
export const metadata = { title: "Inicio" };
