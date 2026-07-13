/**
 * Back office · Leads: contactos capturados por los bots de todos los
 * negocios, con exportación a CSV.
 */

import { createLeadRepository } from "@/core/storage/factory";
import { resolveBusinessBySlug } from "@/businesses/resolve";
import type { BusinessConfig, LeadState } from "@/core/types";
import { DataTable } from "@/components/data-table";
import { Pill } from "@/components/ui";
import { ExportCsvButton, type LeadCsvRow } from "./export-csv";

export const dynamic = "force-dynamic";

const ESTADO_TONE: Record<LeadState, "success" | "warn" | "info" | "neutral"> = {
  nuevo: "neutral",
  interesado: "info",
  agendado: "warn",
  pagado: "success",
  recurrente: "success",
  perdido: "neutral",
};

function fecha(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const hora = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoy.toDateString()) return `Hoy ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer ${hora}`;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

export default async function LeadsPage() {
  const repo = createLeadRepository();
  const leads = await repo.list();

  const configs = new Map<string, BusinessConfig>();
  for (const slug of new Set(leads.map((l) => l.businessSlug))) {
    const resolved = await resolveBusinessBySlug(slug);
    if (resolved) configs.set(slug, resolved.config);
  }

  const csvRows: LeadCsvRow[] = leads.map((l) => ({
    negocio: configs.get(l.businessSlug)?.name ?? l.businessSlug,
    contacto: l.name ?? l.contact,
    canal: l.channel,
    fecha: l.createdAt,
    estado: l.state,
  }));

  return (
    <div className="mx-auto max-w-[980px] space-y-5 fade-up">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-mid">
          {leads.length} {leads.length === 1 ? "lead" : "leads"} en total
        </p>
        <ExportCsvButton rows={csvRows} />
      </div>

      <DataTable
        headers={["Negocio", "Contacto", "Canal", "Fecha", "Estado"]}
        emptyText="Aún no hay leads capturados."
        rows={leads.map((l) => ({
          key: l.id,
          cells: [
            <span key="n" className="font-bold text-ink">
              {configs.get(l.businessSlug)?.name ?? l.businessSlug}
            </span>,
            <span key="c" className="text-ink-mid">
              {l.name ?? l.contact}
            </span>,
            <span key="ch" className="inline-flex items-center gap-1.5 text-ink-mid">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  l.channel === "whatsapp" ? "bg-success" : "bg-ink-soft"
                }`}
              />
              {l.channel === "whatsapp" ? "WhatsApp" : l.channel}
            </span>,
            <span key="f" className="text-ink-mid">
              {fecha(l.updatedAt)}
            </span>,
            <Pill key="e" tone={ESTADO_TONE[l.state]}>
              {l.state}
            </Pill>,
          ],
        }))}
      />
    </div>
  );
}
