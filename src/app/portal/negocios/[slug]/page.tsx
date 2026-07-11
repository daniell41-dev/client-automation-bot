/**
 * Portal · Detalle de un negocio: resumen de config + leads recibidos.
 * RLS garantiza que solo el dueño (o un admin) puede ver esta página.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { nextAction } from "@/core/engine/lead-state";
import type { LeadState } from "@/core/types";

export const dynamic = "force-dynamic";

const STATE_STYLES: Record<LeadState, string> = {
  nuevo: "bg-slate-100 text-slate-700",
  interesado: "bg-blue-100 text-blue-700",
  agendado: "bg-amber-100 text-amber-800",
  pagado: "bg-green-100 text-green-700",
  recurrente: "bg-purple-100 text-purple-700",
  perdido: "bg-red-100 text-red-700",
};

interface LeadRowView {
  id: string;
  name: string | null;
  service_id: string | null;
  state: LeadState;
  tentative_date: string | null;
  updated_at: string;
}

export default async function NegocioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createUserClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id, slug, config, whatsapp_phone_number_id, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();

  const config = parseBusinessConfig(negocio.config);
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, service_id, state, tentative_date, updated_at")
    .eq("business_slug", slug)
    .order("updated_at", { ascending: false });

  const leadRows = (leads ?? []) as LeadRowView[];
  const serviceName = (id: string | null) =>
    config?.services.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{config?.name ?? negocio.slug}</h1>
          <p className="text-sm text-slate-500">slug: {negocio.slug}</p>
        </div>
        <Link
          href={`/portal/negocios/${negocio.slug}/editar`}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Editar configuración
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Servicios</p>
          <p className="text-2xl font-semibold text-slate-800">
            {config?.services.length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Leads</p>
          <p className="text-2xl font-semibold text-slate-800">{leadRows.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">WhatsApp</p>
          <p className="text-sm font-medium text-slate-800">
            {negocio.whatsapp_phone_number_id ? "Conectado" : "Sin conectar"}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Leads</h2>
        {leadRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Aún no hay leads para este negocio.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Servicio</th>
                  <th className="px-4 py-3 font-medium">Fecha tentativa</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Próxima acción</th>
                </tr>
              </thead>
              <tbody>
                {leadRows.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {lead.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {serviceName(lead.service_id)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.tentative_date ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[lead.state]}`}
                      >
                        {lead.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {nextAction(lead.state)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
