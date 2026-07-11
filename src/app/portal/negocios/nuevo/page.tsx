/**
 * Portal · Crear negocio desde un rubro asignado.
 * El negocio nace como copia de la plantilla del rubro.
 */

import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { crearNegocio } from "@/app/portal/actions";
import { ActionForm } from "@/components/action-form";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

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
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Nuevo negocio</h1>
        <p className="text-sm text-slate-500">
          Se crea con la plantilla del rubro; después lo personalizas a tu gusto.
        </p>
      </header>

      {rubros.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No tienes rubros asignados. Pide al administrador que te asigne uno.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
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
                    Elige un rubro…
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
                <input name="nombre" required className={inputCls} placeholder="Estética Bella" />
              </div>
              <div>
                <label className={labelCls}>Slug (identificador, kebab-case)</label>
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  className={inputCls}
                  placeholder="estetica-bella"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Identifica tu negocio en el sistema; no se puede cambiar después.
                </p>
              </div>
            </div>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
