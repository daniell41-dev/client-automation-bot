/**
 * Back office · Asignaciones: qué rubros puede usar cada cliente.
 * (Accesible desde Usuarios → "Asignar rubros".)
 */

import { createUserClient } from "@/lib/supabase/server";
import { asignarRubro, quitarAsignacion } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";
import { DataTable } from "@/components/data-table";
import { Avatar, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

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
    <div className="mx-auto max-w-[980px] space-y-5 fade-up">
      <Card
        title="Asignar rubro"
        subtitle="Un cliente solo puede crear negocios desde sus rubros asignados."
      >
        <ActionForm action={asignarRubro} submitLabel="Asignar">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Usuario</label>
              <select name="user_id" required className={inputCls} defaultValue="">
                <option value="" disabled>
                  Elegí un usuario…
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
                  Elegí un rubro…
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
      </Card>

      <DataTable
        headers={["Usuario", "Rubro", "Desde", "Acciones"]}
        emptyText="Sin asignaciones todavía."
        rows={((asignaciones ?? []) as unknown as AsignacionRow[]).map((a) => ({
          key: a.id,
          cells: [
            <span key="u" className="flex items-center gap-2.5">
              <Avatar name={a.profiles?.email ?? "?"} tone="soft" />
              <span className="max-w-[200px] truncate font-bold text-ink">
                {a.profiles?.email ?? "—"}
              </span>
            </span>,
            <span key="r" className="text-ink-mid">
              {a.rubros?.nombre ?? "—"}
            </span>,
            <span key="f" className="text-ink-mid">
              {new Date(a.created_at).toLocaleDateString("es-CO")}
            </span>,
            <form key="q" action={quitarAsignacion}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                className="text-sm font-semibold text-warn-ink hover:underline"
              >
                Quitar
              </button>
            </form>,
          ],
        }))}
      />
    </div>
  );
}
