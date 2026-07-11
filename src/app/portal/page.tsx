/**
 * Dashboard del portal: rubros asignados al cliente y sus negocios.
 */

import Link from "next/link";
import { createUserClient, getUserRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AsignacionView {
  id: string;
  rubros: { id: string; nombre: string; descripcion: string | null } | null;
}

export default async function PortalHome() {
  const me = await getUserRole();
  const supabase = await createUserClient();

  const [{ data: asignaciones }, { data: negocios }] = await Promise.all([
    supabase
      .from("asignaciones")
      .select("id, rubros(id, nombre, descripcion)")
      .eq("user_id", me!.userId),
    supabase
      .from("negocios")
      .select("id, slug, config, updated_at")
      .eq("owner_id", me!.userId)
      .order("updated_at", { ascending: false }),
  ]);

  const rubros = ((asignaciones ?? []) as unknown as AsignacionView[])
    .map((a) => a.rubros)
    .filter(Boolean);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Mi portal</h1>
        <p className="text-sm text-slate-500">
          Configura el bot de tu negocio a partir de tus rubros asignados
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Mis rubros</h2>
        {rubros.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Aún no tienes rubros asignados. Pide al administrador que te asigne uno.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rubros.map((r) => (
              <div key={r!.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-medium text-slate-800">{r!.nombre}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {r!.descripcion ?? "Plantilla lista para personalizar."}
                </p>
                <Link
                  href={`/portal/negocios/nuevo?rubro=${r!.id}`}
                  className="mt-3 inline-block text-sm text-blue-600 hover:underline"
                >
                  Crear negocio desde este rubro →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Mis negocios</h2>
        {(negocios ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Todavía no has creado ningún negocio.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(negocios ?? []).map((n) => {
              const nombre =
                (n.config as { name?: string } | null)?.name ?? n.slug;
              return (
                <Link
                  key={n.id}
                  href={`/portal/negocios/${n.slug}`}
                  className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400"
                >
                  <h3 className="font-medium text-slate-800">{nombre}</h3>
                  <p className="mt-1 text-xs text-slate-500">slug: {n.slug}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Actualizado {new Date(n.updated_at).toLocaleDateString("es-CO")}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
