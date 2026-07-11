/**
 * Back office · Leads: vista global de todos los leads del bot.
 * (Sustituye al antiguo /admin, que ahora redirige aquí.)
 */

import { createLeadRepository } from "@/core/storage/factory";
import { resolveBusinessBySlug } from "@/businesses/resolve";
import { nextAction } from "@/core/engine/lead-state";
import type { BusinessConfig, Lead, LeadState } from "@/core/types";

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

export default async function LeadsPage() {
  const repo = createLeadRepository();
  const leads = await repo.list();

  const configs = new Map<string, BusinessConfig>();
  for (const slug of new Set(leads.map((l) => l.businessSlug))) {
    const resolved = await resolveBusinessBySlug(slug);
    if (resolved) configs.set(slug, resolved.config);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-slate-500">
          {leads.length} {leads.length === 1 ? "lead" : "leads"} en total
        </p>
      </header>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          <p className="font-medium">Aún no hay leads.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Negocio</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {lead.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lead.businessSlug}</td>
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
                  <td className="px-4 py-3 text-slate-600">{nextAction(lead.state)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
