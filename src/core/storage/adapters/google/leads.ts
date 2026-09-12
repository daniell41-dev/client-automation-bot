/**
 * Adaptador de leads sobre Google Sheets.
 *
 * Espejo de `JsonLeadRepository` (adapters/json.ts) pero persistiendo en una
 * pestaña "Leads" de una hoja de cálculo. Cada lead es una fila; el upsert se
 * hace por `id` (columna A). Pensado para volumen pequeño (un negocio), igual
 * que el adaptador JSON.
 */

import type {
  Channel,
  ConversationStage,
  FollowUpThreshold,
  Lead,
  LeadState,
} from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { SheetsApi } from "@/core/storage/adapters/google/auth";

const TAB = "Leads";

/** Columnas A..P de la pestaña "Leads", en orden. */
const HEADERS = [
  "id",
  "businessSlug",
  "channel",
  "contact",
  "name",
  "serviceId",
  "tentativeDate",
  "state",
  "stage",
  "createdAt",
  "updatedAt",
  "lastInboundAt",
  "followUpsSent",
  "notes",
  "appointmentAt",
  "confirmedAt",
] as const;

const LAST_COL = "P"; // 16 columnas (T-20: appointmentAt/confirmedAt agregadas al final —
// una fila vieja de 14 columnas simplemente no tiene O/P, que `fromRow` lee como `undefined`)

function toRow(lead: Lead): string[] {
  return [
    lead.id,
    lead.businessSlug,
    lead.channel,
    lead.contact,
    lead.name ?? "",
    lead.serviceId ?? "",
    lead.tentativeDate ?? "",
    lead.state,
    lead.stage,
    lead.createdAt,
    lead.updatedAt,
    lead.lastInboundAt,
    JSON.stringify(lead.followUpsSent ?? []),
    lead.notes ?? "",
    lead.appointmentAt ?? "",
    lead.confirmedAt ?? "",
  ];
}

function fromRow(row: string[]): Lead {
  const cell = (i: number): string => row[i] ?? "";
  let followUpsSent: FollowUpThreshold[] = [];
  try {
    const parsed = JSON.parse(cell(12) || "[]");
    if (Array.isArray(parsed)) followUpsSent = parsed as FollowUpThreshold[];
  } catch {
    followUpsSent = [];
  }
  return {
    id: cell(0),
    businessSlug: cell(1),
    channel: cell(2) as Channel,
    contact: cell(3),
    name: cell(4) || undefined,
    serviceId: cell(5) || undefined,
    tentativeDate: cell(6) || undefined,
    state: cell(7) as LeadState,
    stage: cell(8) as ConversationStage,
    createdAt: cell(9),
    updatedAt: cell(10),
    lastInboundAt: cell(11),
    followUpsSent,
    notes: cell(13) || undefined,
    appointmentAt: cell(14) || undefined,
    confirmedAt: cell(15) || undefined,
  };
}

export class GoogleSheetsLeadRepository implements LeadRepository {
  private ready?: Promise<void>;

  constructor(private readonly sheets: SheetsApi) {}

  /** Garantiza una sola vez que la pestaña y sus encabezados existen. */
  private ensure(): Promise<void> {
    this.ready ??= this.sheets.ensureSheet(TAB, [...HEADERS]);
    return this.ready;
  }

  /** Lee todas las filas de datos (sin encabezado) como leads. */
  private async readAll(): Promise<Lead[]> {
    await this.ensure();
    const rows = await this.sheets.getValues(`${TAB}!A2:${LAST_COL}`);
    return rows.filter((r) => r[0]).map(fromRow);
  }

  async findByContact(
    businessSlug: string,
    contact: string,
  ): Promise<Lead | null> {
    const leads = await this.readAll();
    return (
      leads.find(
        (l) => l.businessSlug === businessSlug && l.contact === contact,
      ) ?? null
    );
  }

  async getById(id: string): Promise<Lead | null> {
    const leads = await this.readAll();
    return leads.find((l) => l.id === id) ?? null;
  }

  async save(lead: Lead): Promise<Lead> {
    await this.ensure();
    const rows = await this.sheets.getValues(`${TAB}!A2:${LAST_COL}`);
    const index = rows.findIndex((r) => r[0] === lead.id);
    if (index >= 0) {
      const rowNumber = index + 2; // los datos empiezan en la fila 2
      await this.sheets.updateValues(`${TAB}!A${rowNumber}:${LAST_COL}${rowNumber}`, [
        toRow(lead),
      ]);
    } else {
      await this.sheets.appendValues(`${TAB}!A2:${LAST_COL}`, [toRow(lead)]);
    }
    return lead;
  }

  async list(businessSlug?: string): Promise<Lead[]> {
    const leads = await this.readAll();
    const filtered = businessSlug
      ? leads.filter((l) => l.businessSlug === businessSlug)
      : leads;
    return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
