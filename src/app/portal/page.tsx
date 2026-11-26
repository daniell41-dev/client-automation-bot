/**
 * Portal · Inicio de la dueña: primero lo que le toca hacer hoy (sumando
 * todos sus negocios), después el resumen del día y sus negocios.
 *
 * Antes esta pantalla era solo un selector de negocio: para enterarse de un
 * pago que no cuadraba había que abrir cada negocio. Con un solo negocio ni
 * siquiera se muestra: se entra directo a su Resumen, que tiene los mismos
 * pendientes arriba.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { EmptyState, Pill, StatCard } from "@/components/ui";
import { Logo } from "@/components/logo";
import { RubroTile } from "@/components/rubro-visual";
import { LeTocaAUsted } from "@/components/le-toca-a-usted";
import { ArrowRight } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { ActionForm } from "@/components/action-form";
import { crearMiNegocio } from "./primer-negocio/actions";
import {
  armarPendientes,
  fechaLarga,
  pedidosDeHoy,
  formatoMonto,
  saludo,
  type PedidoInicio,
} from "@/lib/inicio-portal";
import { inicioDelDia, ventasDelDia } from "@/core/engine/ventas-del-dia";
import { formato, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (portal.misNegocios). */
const tt = textos.portal.misNegocios;

export const dynamic = "force-dynamic";

interface NegocioCard {
  id: string;
  slug: string;
  nombre: string;
  rubro: string;
  tag: string;
  botActivo: boolean;
  mensajesHoy: number;
  pedidosHoy: number;
  pendientes: number;
  ultimoMensaje: { texto: string; hora: string } | null;
}

/** Estados en los que un pedido espera algo de la dueña o se cuenta como venta. */
const FILTRO_PEDIDOS = (desde: string) =>
  `estado.eq.por_verificar,created_at.gte.${desde},devolucion_estado.in.(pendiente,pidiendo_cuenta)`;

function firstName(email: string): string {
  const raw = email.split("@")[0] ?? "";
  const name = raw.split(/[._-]/)[0] ?? raw;
  return name ? name[0].toUpperCase() + name.slice(1) : "!";
}

export default async function PortalHome() {
  const me = await getUserRole();
  const supabase = await createUserClient();

  const { data: negocios } = await supabase
    .from("negocios")
    .select("id, slug, config, updated_at, rubros(nombre)")
    .eq("owner_id", me!.userId)
    .order("updated_at", { ascending: false });

  // Con un solo negocio, elegir negocio es un paso de más: su Resumen ya
  // muestra los mismos pendientes arriba.
  if (negocios?.length === 1) redirect(`/portal/negocios/${negocios[0].slug}`);

  const slugs = (negocios ?? []).map((n) => n.slug);
  const ids = (negocios ?? []).map((n) => n.id);

  // T-42: sin negocios, la dueña arma el suyo eligiendo entre los rubros que
  // el admin le asignó al invitarla (la política `rubros_asignados` ya filtra).
  const { data: rubros } = slugs.length
    ? { data: [] as { id: string; nombre: string }[] }
    : await supabase.from("rubros").select("id, nombre").order("nombre");

  // Mensajes de hoy por negocio (turnos de las sesiones actualizadas hoy).
  // Medianoche de Colombia, no la del servidor (UTC): con setHours(0) el
  // "hoy" empezaba a las 7 p. m. del día anterior.
  const hoy = inicioDelDia(new Date(), "America/Bogota");
  const [{ data: sesiones }, { data: pedidosData }] = slugs.length
    ? await Promise.all([
        supabase
          .from("sesiones")
          .select("business_slug, history, updated_at")
          .in("business_slug", slugs)
          .gte("updated_at", hoy.toISOString())
          .order("updated_at", { ascending: false }),
        supabase
          .from("pedidos")
          .select("negocio_id, numero, cliente, total, monto_pagado, moneda, estado, created_at, devolucion_estado, comprobantes(*)")
          .in("negocio_id", ids)
          .or(FILTRO_PEDIDOS(hoy.toISOString()))
          .limit(500),
      ])
    : [{ data: [] as { business_slug: string; history: unknown; updated_at: string }[] }, { data: [] }];

  const mensajesPorNegocio = new Map<string, number>();
  const ultimoPorNegocio = new Map<string, { texto: string; hora: string }>();
  for (const s of sesiones ?? []) {
    const turnos = Array.isArray(s.history)
      ? (s.history as { role?: string; text?: string; timestamp?: string }[])
      : [];
    const deHoy = turnos.filter((t) => t.timestamp && new Date(t.timestamp) >= hoy);
    mensajesPorNegocio.set(
      s.business_slug,
      (mensajesPorNegocio.get(s.business_slug) ?? 0) + deHoy.length,
    );
    // Las sesiones vienen de la más reciente a la más vieja: la primera que
    // aparece por negocio tiene su último mensaje. Se muestra lo que escribió
    // el cliente, que es lo que le dice a la dueña de qué va la conversación.
    if (!ultimoPorNegocio.has(s.business_slug)) {
      const delCliente = [...deHoy].reverse().find((t) => t.role === "user" && t.text);
      if (delCliente?.text) {
        ultimoPorNegocio.set(s.business_slug, {
          texto: delCliente.text,
          hora: new Intl.DateTimeFormat("es-CO", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Bogota",
          }).format(new Date(delCliente.timestamp!)),
        });
      }
    }
  }

  const pedidos = (pedidosData ?? []) as unknown as PedidoInicio[];
  const negociosInicio = (negocios ?? []).map((n) => ({
    id: n.id,
    slug: n.slug,
    nombre: parseBusinessConfig(n.config)?.name ?? n.slug,
  }));
  const pendientes = armarPendientes(pedidos, negociosInicio);
  const vendidosHoy = pedidosDeHoy(pedidos, hoy);
  // "Vendido" = solo lo que la dueña ya aprobó (ver core/engine/ventas-del-dia.ts).
  const ventas = ventasDelDia(pedidos, hoy);
  const mensajesHoy = [...mensajesPorNegocio.values()].reduce((a, b) => a + b, 0);
  const ahora = new Date();

  const cards: NegocioCard[] = (negocios ?? []).map((n) => {
    const config = parseBusinessConfig(n.config);
    const rubro =
      (n.rubros as unknown as { nombre: string } | null)?.nombre ?? textos.comun.negocio;
    const categorias = [
      ...new Set(config?.services.map((s) => s.categoria).filter(Boolean)),
    ] as string[];
    return {
      id: n.id,
      slug: n.slug,
      nombre: config?.name ?? n.slug,
      rubro,
      tag: categorias[0] ?? config?.services[0]?.name ?? "",
      botActivo: config?.botActivo !== false,
      mensajesHoy: mensajesPorNegocio.get(n.slug) ?? 0,
      pedidosHoy: vendidosHoy.filter((p) => p.negocio_id === n.id).length,
      pendientes: pedidos.filter(
        (p) =>
          p.negocio_id === n.id &&
          (p.estado === "por_verificar" ||
            p.devolucion_estado === "pendiente" ||
            p.devolucion_estado === "pidiendo_cuenta"),
      ).length,
      ultimoMensaje: ultimoPorNegocio.get(n.slug) ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-canvas">
      {/* Topbar */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-6 py-3.5">
          <Link href="/portal">
            <Logo />
          </Link>
          <span className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-ink">{me!.email}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {firstName(me!.email).slice(0, 2).toUpperCase()}
            </span>
            {/* T-35: sin esto, una dueña sin negocios no tenía forma de salir
                (el botón de salir vive en el shell de cada negocio). */}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-[10px] px-3 py-1.5 text-sm font-semibold text-ink-mid transition-colors hover:bg-surface-3 hover:text-ink"
              >{tt.cerrarSesion}</button>
            </form>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] space-y-7 px-6 py-10 fade-up">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">
            {fechaLarga(ahora)}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-extrabold leading-tight text-ink">
            {saludo(ahora)}, {firstName(me!.email)}
          </h1>
          <p className="mt-1 text-[15px] text-ink-mid">
            {cards.length === 0
              ? tt.arranquemosPorArmarSu
              : formato(tt.hoyAtendio, {
                  mensajes: mensajesHoy === 1 ? tt.mensaje.uno : formato(tt.mensaje.varios, { n: mensajesHoy }),
                  n: cards.length,
                  pendientes: pendientes.length > 0 ? tt.conPendientes : tt.sinPendientes,
                })}
          </p>
        </div>

        {cards.length > 0 && <LeTocaAUsted pendientes={pendientes} />}

        {cards.length > 0 && (
          <section aria-label={tt.resumenDeHoy} className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label={tt.mensajesHoy} value={String(mensajesHoy)} delta={tt.enTodosSusNegocios} deltaTone="neutral" />
            <StatCard
              label={tt.vendidoHoy}
              value={ventas.total === null ? "—" : formatoMonto(ventas.total, ventas.moneda ?? "COP")}
              delta={
                (ventas.vendidos === 1 ? tt.pedidosAprobados.uno : formato(tt.pedidosAprobados.varios, { n: ventas.vendidos })) +
                (ventas.porAprobar > 0 ? formato(tt.masPorAprobar, { n: ventas.porAprobar }) : "")
              }
              deltaTone="neutral"
            />
            <StatCard
              label={tt.porRevisar}
              value={String(pendientes.length)}
              delta={pendientes.length > 0 ? tt.veaLaListaDe : tt.todoAlDia}
              deltaTone={pendientes.length > 0 ? "neutral" : "success"}
            />
          </section>
        )}

        {cards.length === 0 ? (
          <div className="mt-8">
            {(rubros ?? []).length === 0 ? (
              <EmptyState
                title={tt.todaviaNoTieneNingun}
                subtitle={tt.pidaleAlAdministradorDe}
              />
            ) : (
              <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
                <h2 className="text-[17.5px] font-bold text-ink">{tt.armeSuNegocio}</h2>
                <p className="mt-1 text-sm text-ink-mid">{tt.elijaQueTipoDe}</p>
                <ActionForm action={crearMiNegocio} submitLabel={tt.crearMiNegocio} className="mt-5 space-y-4">
                  <fieldset className="grid gap-3 sm:grid-cols-2">
                    <legend className="mb-2 text-sm font-semibold text-ink">{tt.tipoDeNegocio}</legend>
                    {(rubros ?? []).map((r, i) => (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-primary has-[:checked]:bg-surface-3"
                      >
                        <input type="radio" name="rubroId" value={r.id} defaultChecked={i === 0} />
                        <RubroTile rubroNombre={r.nombre} />
                        <span className="text-sm font-semibold text-ink">{r.nombre}</span>
                      </label>
                    ))}
                  </fieldset>
                  <label className="block">
                    <span className="text-sm font-semibold text-ink">{tt.nombreDelNegocio}</span>
                    <input
                      name="nombre"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder={tt.ejUnasLucia}
                      className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                    />
                  </label>
                </ActionForm>
              </section>
            )}
          </div>
        ) : (
          <section aria-labelledby="sus-negocios" className="space-y-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="sus-negocios" className="text-[17px] font-extrabold text-ink">{tt.susNegocios}</h2>
              <p className="text-[13px] text-ink-mid">{tt.entreAUnoPara}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {cards.map((card) => (
                <Link
                  key={card.id}
                  href={`/portal/negocios/${card.slug}`}
                  className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-border hover:shadow-lift"
                >
                  <div className="flex items-start gap-3.5">
                    <RubroTile rubroNombre={card.rubro} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-extrabold text-ink">{card.nombre}</h3>
                      <p className="mt-0.5 text-[13px] text-ink-mid">
                        {card.rubro}
                        {card.tag ? ` · ${card.tag}` : ""}
                      </p>
                    </div>
                    <Pill tone={card.botActivo ? "success" : "warn"} dot>
                      {card.botActivo ? tt.asistenteActivo : tt.asistenteEnPausa}
                    </Pill>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-3 p-3">
                    <div>
                      <p className="font-display text-xl font-bold text-ink">{card.mensajesHoy}</p>
                      <p className="text-xs text-ink-mid">{tt.mensajesHoy2}</p>
                    </div>
                    <div>
                      <p className="font-display text-xl font-bold text-ink">{card.pedidosHoy}</p>
                      <p className="text-xs text-ink-mid">{tt.pedidosHoy}</p>
                    </div>
                    <div>
                      <p className={`font-display text-xl font-bold ${card.pendientes > 0 ? "text-gold-ink" : "text-ink"}`}>
                        {card.pendientes}
                      </p>
                      <p className="text-xs text-ink-mid">{tt.porRevisar2}</p>
                    </div>
                  </div>
                  <p className="truncate text-[13px] text-ink-mid">
                    {card.ultimoMensaje
                      ? `${card.ultimoMensaje.hora} · "${card.ultimoMensaje.texto}"`
                      : tt.sinMensajesDeClientes}
                  </p>
                  <div className="flex items-center justify-end border-t border-line pt-3.5">
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">{tt.abrirPanel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// T-71: el nombre de la pestaña ("Mis negocios · Aurela"); la plantilla vive en el layout raíz.
export const metadata = { title: textos.portal.titulosPestana.misNegocios };
