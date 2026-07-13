/**
 * /demo — vista pública de demostración (sin login), estilo Nexo.
 * Cliente anónimo: RLS solo deja leer las filas `es_demo = true`.
 */

import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/anon";
import { parseBusinessConfig } from "@/core/config-schema";
import { Logo } from "@/components/logo";
import { EmptyState, Pill } from "@/components/ui";
import { RubroTile } from "@/components/rubro-visual";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const supabase = createAnonClient();

  const [{ data: rubros }, { data: negocios }] = supabase
    ? await Promise.all([
        supabase.from("rubros").select("nombre, descripcion").eq("es_demo", true),
        supabase.from("negocios").select("slug, config").eq("es_demo", true).limit(1),
      ])
    : [{ data: null }, { data: null }];

  const negocio = negocios?.[0];
  const config = negocio ? parseBusinessConfig(negocio.config) : null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-6 py-3.5">
          <Logo />
          <Link
            href="/login"
            className="rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] space-y-8 px-6 py-10 fade-up">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Demo
          </p>
          <h1 className="mt-1 text-[32px] font-extrabold leading-tight text-ink">
            Así se ve un negocio en Nexo
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-ink-mid">
            Este es un negocio de ejemplo configurado en la plataforma. Podés
            probar el bot como si fueras un cliente escribiéndole por WhatsApp.
          </p>
        </div>

        {!supabase || !config ? (
          <EmptyState
            title="Aún no hay negocio de demostración."
            subtitle={
              supabase
                ? "Corré el seed: pnpm seed:supabase"
                : "Supabase no está configurado en este entorno."
            }
          />
        ) : (
          <>
            {(rubros ?? []).map((r) => (
              <div
                key={r.nombre}
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
              >
                <RubroTile rubroNombre={r.nombre} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[17px] font-bold text-ink">{config.name}</h2>
                    <Pill tone="success" dot>
                      Bot activo
                    </Pill>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-mid">
                    {r.nombre} · {r.descripcion ?? "Negocio de ejemplo"}
                  </p>
                </div>
              </div>
            ))}

            {/* Catálogo de ejemplo */}
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-surface-3">
                    {["Servicio", "Duración", "Precio"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {config.services.map((s) => (
                    <tr key={s.id} className="border-t border-line">
                      <td className="px-4 py-3 font-bold text-ink">{s.name}</td>
                      <td className="px-4 py-3 text-ink-mid">{s.durationMinutes} min</td>
                      <td className="px-4 py-3 text-ink-mid">
                        {new Intl.NumberFormat(config.locale ?? "es-CO", {
                          style: "currency",
                          currency: config.currency,
                          maximumFractionDigits: 0,
                        }).format(s.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-center">
              <Link
                href="/demo/chat"
                className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Probar el bot
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
