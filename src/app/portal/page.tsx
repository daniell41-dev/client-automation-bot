/**
 * Portal · Selección de rubro/negocio.
 * El cliente puede tener varios negocios; acá elige cuál gestionar.
 */

import Link from "next/link";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { EmptyState, Pill } from "@/components/ui";
import { Logo } from "@/components/logo";
import { RubroTile } from "@/components/rubro-visual";
import { ArrowRight } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { ActionForm } from "@/components/action-form";
import { crearMiNegocio } from "./primer-negocio/actions";

export const dynamic = "force-dynamic";

interface NegocioCard {
  id: string;
  slug: string;
  nombre: string;
  rubro: string;
  tag: string;
  botActivo: boolean;
  mensajesHoy: number;
}

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

  const slugs = (negocios ?? []).map((n) => n.slug);

  // T-42: sin negocios, la dueña arma el suyo eligiendo entre los rubros que
  // el admin le asignó al invitarla (la política `rubros_asignados` ya filtra).
  const { data: rubros } = slugs.length
    ? { data: [] as { id: string; nombre: string }[] }
    : await supabase.from("rubros").select("id, nombre").order("nombre");

  // Mensajes de hoy por negocio (turnos de las sesiones actualizadas hoy).
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const { data: sesiones } = slugs.length
    ? await supabase
        .from("sesiones")
        .select("business_slug, history")
        .in("business_slug", slugs)
        .gte("updated_at", hoy.toISOString())
    : { data: [] as { business_slug: string; history: unknown }[] };

  const mensajesPorNegocio = new Map<string, number>();
  for (const s of sesiones ?? []) {
    const turns = Array.isArray(s.history)
      ? (s.history as { timestamp?: string }[]).filter(
          (t) => t.timestamp && new Date(t.timestamp) >= hoy,
        ).length
      : 0;
    mensajesPorNegocio.set(
      s.business_slug,
      (mensajesPorNegocio.get(s.business_slug) ?? 0) + turns,
    );
  }

  const cards: NegocioCard[] = (negocios ?? []).map((n) => {
    const config = parseBusinessConfig(n.config);
    const rubro =
      (n.rubros as unknown as { nombre: string } | null)?.nombre ?? "Negocio";
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
    };
  });

  return (
    <div className="min-h-screen bg-canvas">
      {/* Topbar */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-6 py-3.5">
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
              >
                Cerrar sesión
              </button>
            </form>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-6 py-10 fade-up">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
          Tus negocios
        </p>
        <h1 className="mt-1 text-[32px] font-extrabold text-ink">
          Hola, {firstName(me!.email)}
        </h1>
        <p className="mt-1 text-[15px] text-ink-mid">
          Elegí el negocio que querés gestionar. Cada uno tiene su propio bot de
          WhatsApp.
        </p>

        {cards.length === 0 ? (
          <div className="mt-8">
            {(rubros ?? []).length === 0 ? (
              <EmptyState
                title="Todavía no tenés ningún negocio."
                subtitle="Pedile al administrador de la plataforma que te asigne un tipo de negocio."
              />
            ) : (
              <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
                <h2 className="text-[17.5px] font-bold text-ink">Armá tu negocio</h2>
                <p className="mt-1 text-sm text-ink-mid">
                  Elegí qué tipo de negocio es y cómo se llama. Arrancamos con una
                  plantilla que después ajustás a tu gusto; el bot queda apagado
                  hasta que conectemos tu número de WhatsApp.
                </p>
                <ActionForm action={crearMiNegocio} submitLabel="Crear mi negocio" className="mt-5 space-y-4">
                  <fieldset className="grid gap-3 sm:grid-cols-2">
                    <legend className="mb-2 text-sm font-semibold text-ink">Tipo de negocio</legend>
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
                    <span className="text-sm font-semibold text-ink">Nombre del negocio</span>
                    <input
                      name="nombre"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Ej: Uñas Lucía"
                      className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                    />
                  </label>
                </ActionForm>
              </section>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <Link
                key={card.id}
                href={`/portal/negocios/${card.slug}`}
                className="group rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-[#B2CCF4] hover:shadow-lift"
              >
                <div className="flex items-start justify-between">
                  <RubroTile rubroNombre={card.rubro} size="lg" />
                  <Pill tone={card.botActivo ? "success" : "warn"} dot>
                    {card.botActivo ? "Bot activo" : "Bot en pausa"}
                  </Pill>
                </div>
                <h2 className="mt-4 text-[17.5px] font-bold text-ink">
                  {card.nombre}
                </h2>
                <p className="mt-0.5 text-sm text-ink-mid">
                  {card.rubro}
                  {card.tag ? ` · ${card.tag}` : ""}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-line pt-3.5">
                  <span className="text-[13px] text-ink-soft">
                    {card.mensajesHoy} mensajes hoy
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                    Abrir
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
