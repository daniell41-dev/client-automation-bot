/**
 * Portal · Crear negocio desde un rubro asignado.
 * El negocio nace como copia de la plantilla del rubro.
 */

import Link from "next/link";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { crearNegocio } from "@/app/portal/actions";
import { ActionForm } from "@/components/action-form";
import { Logo } from "@/components/logo";
import { EmptyState } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

interface AsignacionView {
  rubros: { id: string; nombre: string } | null;
}

export default async function NuevoNegocioPage({
  searchParams,
}: {
  searchParams: Promise<{ rubro?: string }>;
}) {
  const { rubro: rubroPre } = await searchParams;
  const me = await getUserRole();
  const supabase = await createUserClient();

  const { data: asignaciones } = await supabase
    .from("asignaciones")
    .select("rubros(id, nombre)")
    .eq("user_id", me!.userId);

  const rubros = ((asignaciones ?? []) as unknown as AsignacionView[])
    .map((a) => a.rubros)
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-6 py-3.5">
          <Link href="/portal">
            <Logo />
          </Link>
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mid hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-10 fade-up">
        <h1 className="text-[26px] font-extrabold text-ink">Nuevo negocio</h1>
        <p className="mt-1 text-[15px] text-ink-mid">
          Se crea con la plantilla del rubro; después lo personalizás a tu gusto.
        </p>

        {rubros.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No tenés rubros asignados."
              subtitle="Pedí al administrador que te asigne uno para crear tu negocio."
            />
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-card">
            <ActionForm action={crearNegocio} submitLabel="Crear negocio">
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Rubro</label>
                  <select
                    name="rubro_id"
                    required
                    className={inputCls}
                    defaultValue={rubroPre ?? ""}
                  >
                    <option value="" disabled>
                      Elegí un rubro…
                    </option>
                    {rubros.map((r) => (
                      <option key={r!.id} value={r!.id}>
                        {r!.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nombre del negocio</label>
                  <input
                    name="nombre"
                    required
                    className={inputCls}
                    placeholder="La Parrilla del Centro"
                  />
                </div>
                <div>
                  <label className={labelCls}>Slug (identificador, kebab-case)</label>
                  <input
                    name="slug"
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    className={inputCls}
                    placeholder="la-parrilla-del-centro"
                  />
                  <p className="mt-1.5 text-xs text-ink-soft">
                    Identifica tu negocio en el sistema; no se puede cambiar después.
                  </p>
                </div>
              </div>
            </ActionForm>
          </div>
        )}
      </main>
    </div>
  );
}
