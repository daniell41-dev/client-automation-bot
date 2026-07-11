/**
 * Back office · Asignaciones: qué rubros puede usar cada cliente.
 */

import { createUserClient } from "@/lib/supabase/server";
import { asignarRubro, quitarAsignacion } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

interface AsignacionRow {
  id: string;
  created_at: string;
  profiles: { email: string } | null;
  rubros: { nombre: string } | null;
}

export default async function AsignacionesPage() {
  const supabase = await createUserClient();
  const [{ data: asignaciones }, { data: usuarios }, { data: rubros }] =
    await Promise.all([
      supabase
        .from("asignaciones")
        .select("id, created_at, profiles(email), rubros(nombre)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, role").order("email"),
      supabase.from("rubros").select("id, nombre").order("nombre"),
    ]);

  const clientes = (usuarios ?? []).filter((u) => u.role !== "admin");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Asignaciones</h1>
        <p className="text-sm text-slate-500">
          Un cliente solo puede crear negocios desde sus rubros asignados
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Asignar rubro</h2>
        <ActionForm action={asignarRubro} submitLabel="Asignar">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Usuario</label>
              <select name="user_id" required className={inputCls} defaultValue="">
                <option value="" disabled>
                  Elige un usuario…
                </option>
                {clientes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Rubro</label>
              <select name="rubro_id" required className={inputCls} defaultValue="">
                <option value="" disabled>
                  Elige un rubro…
                </option>
                {(rubros ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </ActionForm>
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Rubro</th>
              <th className="px-4 py-3 font-medium">Desde</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {((asignaciones ?? []) as unknown as AsignacionRow[]).map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {a.profiles?.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{a.rubros?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(a.created_at).toLocaleDateString("es-CO")}
                </td>
                <td className="px-4 py-3">
                  <form action={quitarAsignacion}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Quitar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
