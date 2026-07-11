/**
 * Panel /admin (solo lectura).
 *
 * Muestra los leads guardados y sus estados, para que el negocio vea todo de un
 * vistazo. Es un Server Component: lee del backend configurado (Supabase,
 * Sheets o JSON) vía el factory. No edita nada (la edición vive en el portal).
 */

import { createLeadRepository } from "@/core/storage/factory";
import { resolveBusinessBySlug } from "@/businesses/resolve";
import { nextAction } from "@/core/engine/lead-state";
import type { BusinessConfig, Lead, LeadState } from "@/core/types";

// Lee el archivo de leads en cada request (no prerenderizar en build).
export const dynamic = "force-dynamic";

const STATE_STYLES: Record<LeadState, string> = {
  nuevo: "bg-slate-100 text-slate-700",
  interesado: "bg-blue-100 text-blue-700",
  agendado: "bg-amber-100 text-amber-800",
  pagado: "bg-green-100 text-green-700",
  recurrente: "bg-purple-100 text-purple-700",
  perdido: "bg-red-100 text-red-700",
};

function serviceName(lead: Lead, configs: Map<string, BusinessConfig>): string {
  const business = configs.get(lead.businessSlug);
  return business?.services.find((s) => s.id === lead.serviceId)?.name ?? "—";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminPage() {
  const repo = createLeadRepository();
  const leads = await repo.list();

  // Resuelve la config una sola vez por negocio (no por fila).
  const configs = new Map<string, BusinessConfig>();
  for (const slug of new Set(leads.map((l) => l.businessSlug))) {
    const resolved = await resolveBusinessBySlug(slug);
    if (resolved) configs.set(slug, resolved.config);
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-slate-500">
          Panel de solo lectura · {leads.length}{" "}
          {leads.length === 1 ? "lead" : "leads"} en total
        </p>
      </header>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <p className="mb-2 font-medium">Aún no hay leads.</p>
          <p className="text-sm">
            Genera uno probando el bot:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
              POST /api/dev/simulate
            </code>{" "}
            o conecta el webhook de WhatsApp.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha contacto</th>
                <th className="px-4 py-3 font-medium">Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {lead.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {serviceName(lead, configs)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[lead.state]}`}
                    >
                      {lead.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(lead.createdAt)}
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
    </main>
  );
}
