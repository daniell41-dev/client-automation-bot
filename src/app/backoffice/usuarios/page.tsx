/**
 * Back office · Usuarios: lista de perfiles + alta de usuarios.
 * El alta usa la API admin de Supabase (service role) vía Server Action.
 */

import { createUserClient } from "@/lib/supabase/server";
import { crearUsuario } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

export default async function UsuariosPage() {
  const supabase = await createUserClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-slate-500">
          {profiles?.length ?? 0} usuarios registrados
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Crear usuario</h2>
        <ActionForm action={crearUsuario} submitLabel="Crear usuario">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Correo</label>
              <input name="email" type="email" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contraseña (mín. 8)</label>
              <input name="password" type="password" required minLength={8} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Rol</label>
              <select name="role" className={inputCls} defaultValue="cliente">
                <option value="cliente">Cliente</option>
                <option value="admin">Admin</option>
                <option value="invitado">Invitado</option>
              </select>
            </div>
          </div>
        </ActionForm>
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{p.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {p.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(p.created_at).toLocaleDateString("es-CO")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
