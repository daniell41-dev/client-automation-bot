/**
 * Back office · Rubros: lista de plantillas verticales + alta.
 * El rubro nace con la plantilla base del código; se personaliza en su editor.
 */

import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { crearRubro, eliminarRubro } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

export default async function RubrosPage() {
  const supabase = await createUserClient();
  const { data: rubros } = await supabase
    .from("rubros")
    .select("id, slug, nombre, descripcion, es_demo, updated_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Rubros</h1>
        <p className="text-sm text-slate-500">
          Plantillas verticales que se asignan a los clientes
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Crear rubro</h2>
        <ActionForm action={crearRubro} submitLabel="Crear rubro">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Slug (kebab-case)</label>
              <input name="slug" required className={inputCls} placeholder="barberia" />
            </div>
            <div>
              <label className={labelCls}>Nombre</label>
              <input name="nombre" required className={inputCls} placeholder="Barbería" />
            </div>
            <div>
              <label className={labelCls}>Descripción (opcional)</label>
              <input name="descripcion" className={inputCls} />
            </div>
          </div>
        </ActionForm>
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Demo</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(rubros ?? []).map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{r.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{r.slug}</td>
                <td className="px-4 py-3 text-slate-600">{r.descripcion ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{r.es_demo ? "Sí" : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/backoffice/rubros/${r.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Editar
                    </Link>
                    <form action={eliminarRubro}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
