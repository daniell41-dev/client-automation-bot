/**
 * Back office · Asignaciones: qué rubros puede usar cada cliente.
 * (Accesible desde Usuarios → "Asignar rubros".)
 */

import { createUserClient } from "@/lib/supabase/server";
import { asignarRubro, quitarAsignacion } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable } from "@/components/data-table";
import { Avatar, Card } from "@/components/ui";
import { formato, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (backoffice.asignaciones). */
const tt = textos.backoffice.asignaciones;

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
        title={tt.asignarRubro}
        subtitle={tt.unClienteSoloPuede}
      >
        <ActionForm action={asignarRubro} submitLabel={tt.asignar}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>{tt.usuario}</label>
              <select name="user_id" required className={inputCls} defaultValue="">
                <option value="" disabled>{tt.elijaUnUsuario}</option>
                {clientes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{tt.rubro}</label>
              <select name="rubro_id" required className={inputCls} defaultValue="">
                <option value="" disabled>{tt.elijaUnRubro}</option>
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
        headers={tt.encabezados}
        emptyText={tt.sinAsignaciones}
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
            <ConfirmDeleteButton
              key="q"
              action={quitarAsignacion}
              hiddenFields={{ id: a.id }}
              title={tt.quitarEstaAsignacion}
              description={formato(tt.avisoQuitar, {
                cliente: a.profiles?.email ?? tt.esteCliente,
                rubro: a.rubros?.nombre ?? tt.esteRubro,
              })}
              confirmLabel={tt.siQuitar}
              triggerLabel={tt.quitar}
            />,
          ],
        }))}
      />
    </div>
  );
}

// T-71: el nombre de la pestaña ("Asignaciones · Aurela"); la plantilla vive en el layout raíz.
export const metadata = { title: textos.backoffice.titulosPestana.asignaciones };
