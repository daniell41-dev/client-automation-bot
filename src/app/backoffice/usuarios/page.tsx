/**
 * Back office · Usuarios: tabla de perfiles con negocios y rubros asignados,
 * más el alta de usuarios (API admin de Supabase).
 */

import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { crearUsuario, invitarDuena } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";
import { DataTable } from "@/components/data-table";
import { Avatar, Card, Pill } from "@/components/ui";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (backoffice.usuarios). */
const tt = textos.backoffice.usuarios;

export const dynamic = "force-dynamic";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

export default async function UsuariosPage() {
  const supabase = await createUserClient();

  const [{ data: profiles }, { data: negocios }, { data: asignaciones }, { data: rubros }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("negocios").select("owner_id"),
      supabase.from("asignaciones").select("user_id, rubros(nombre)"),
      supabase.from("rubros").select("id, nombre").order("nombre"),
    ]);

  const negociosPorUser = new Map<string, number>();
  for (const n of negocios ?? []) {
    negociosPorUser.set(n.owner_id, (negociosPorUser.get(n.owner_id) ?? 0) + 1);
  }
  const rubrosPorUser = new Map<string, string[]>();
  for (const a of asignaciones ?? []) {
    const nombre = (a.rubros as unknown as { nombre: string } | null)?.nombre;
    if (!nombre) continue;
    rubrosPorUser.set(a.user_id, [...(rubrosPorUser.get(a.user_id) ?? []), nombre]);
  }

  return (
    <div className="mx-auto max-w-[980px] space-y-5 fade-up">
      {/* T-41: el camino normal para una dueña nueva. */}
      <Card
        title={tt.invitarDuena}
        subtitle={tt.leLlegaUnCorreo}
      >
        <ActionForm action={invitarDuena} submitLabel={tt.enviarInvitacion}>
          <div>
            <label htmlFor="invitar-email" className={labelCls}>{tt.correoDeLaDuena}</label>
            <input id="invitar-email" name="email" type="email" required placeholder={tt.duenaNegocioCo} className={inputCls} />
          </div>
          <fieldset>
            <legend className={labelCls}>{tt.tiposDeNegocioQue}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {(rubros ?? []).map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="rubroIds" value={r.id} defaultChecked />
                  {r.nombre}
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </Card>

      <Card
        title={tt.crearUsuarioConContrasena}
        subtitle={tt.alternativaSinCorreoEl}
        action={
          <Link
            href="/backoffice/asignaciones"
            className="text-sm font-bold text-primary hover:underline"
          >{tt.asignarRubros}</Link>
        }
      >
        <ActionForm action={crearUsuario} submitLabel={tt.invitarUsuario}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>{tt.correo}</label>
              <input name="email" type="email" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tt.contrasenaMin8}</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{tt.rol}</label>
              <select name="role" className={inputCls} defaultValue="cliente">
                <option value="cliente">{tt.cliente}</option>
                <option value="admin">{tt.administrador}</option>
                <option value="invitado">{tt.invitado}</option>
              </select>
            </div>
          </div>
        </ActionForm>
      </Card>

      <DataTable
        headers={tt.encabezados}
        emptyText={tt.sinUsuarios}
        rows={(profiles ?? []).map((p) => ({
          key: p.id,
          cells: [
            <span key="u" className="flex items-center gap-2.5">
              <Avatar name={p.email} tone={p.role === "admin" ? "dark" : "soft"} />
              <span className="max-w-[160px] truncate font-bold text-ink">
                {p.email.split("@")[0]}
              </span>
            </span>,
            <span key="e" className="text-ink-mid">
              {p.email}
            </span>,
            <Pill key="r" tone={p.role === "admin" ? "info" : "neutral"}>
              {p.role === "admin"
                ? tt.administrador
                : p.role === "cliente"
                  ? tt.cliente
                  : tt.invitado}
            </Pill>,
            <span key="n" className="font-display font-bold text-ink">
              {negociosPorUser.get(p.id) ?? 0}
            </span>,
            <span key="a" className="max-w-[220px] truncate text-ink-mid">
              {rubrosPorUser.get(p.id)?.join(", ") ?? "—"}
            </span>,
          ],
        }))}
      />
    </div>
  );
}

// T-71: el nombre de la pestaña ("Usuarios · Aurela"); la plantilla vive en el layout raíz.
export const metadata = { title: textos.backoffice.titulosPestana.usuarios };
