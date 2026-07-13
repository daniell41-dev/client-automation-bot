/**
 * Portal · Selección de rubro/negocio.
 * El cliente puede tener varios negocios; acá elige cuál gestionar.
 */

import Link from "next/link";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { Pill } from "@/components/ui";
import { Logo } from "@/components/logo";
import { RubroTile } from "@/components/rubro-visual";
import { Plus, ArrowRight } from "lucide-react";

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

          {/* Agregar otro negocio */}
          <Link
            href="/portal/negocios/nuevo"
            className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-2 text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-rubro-salud-bg text-rubro-salud-ink">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold">
              {cards.length === 0 ? "Crear tu primer negocio" : "Agregar otro negocio"}
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
