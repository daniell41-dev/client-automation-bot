/**
 * Adaptador de leads sobre Supabase (Postgres).
 *
 * Espejo de los adaptadores JSON y Google Sheets, pero con upsert nativo por
 * `id` y filtrado/orden en la base. Es el backend principal del SaaS.
 */

import type {
  Channel,
  ConversationStage,
  FollowUpThreshold,
  Lead,
  LeadState,
} from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { LeadRow, SupabaseDb } from "@/core/storage/adapters/supabase/api";

function toRow(lead: Lead, negocioId: string | undefined): LeadRow {
  return {
    id: lead.id,
    business_slug: lead.businessSlug,
    channel: lead.channel,
    contact: lead.contact,
    name: lead.name ?? null,
    service_id: lead.serviceId ?? null,
    tentative_date: lead.tentativeDate ?? null,
    state: lead.state,
    stage: lead.stage,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    last_inbound_at: lead.lastInboundAt,
    follow_ups_sent: lead.followUpsSent ?? [],
    notes: lead.notes ?? null,
    negocio_id: negocioId ?? null,
  };
}

function fromRow(row: LeadRow): Lead {
  return {
    id: row.id,
    businessSlug: row.business_slug,
    channel: row.channel as Channel,
    contact: row.contact,
    name: row.name ?? undefined,
    serviceId: row.service_id ?? undefined,
    tentativeDate: row.tentative_date ?? undefined,
    state: row.state as LeadState,
    stage: row.stage as ConversationStage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastInboundAt: row.last_inbound_at,
    followUpsSent: (row.follow_ups_sent ?? []) as FollowUpThreshold[],
    notes: row.notes ?? undefined,
  };
}

export class SupabaseLeadRepository implements LeadRepository {
  constructor(
    private readonly db: SupabaseDb,
    /** FK de conveniencia (T-08) — ver el comentario de `LeadRow.negocio_id`. */
    private readonly negocioId?: string,
  ) {}

  async findByContact(businessSlug: string, contact: string): Promise<Lead | null> {
    const row = await this.db.selectLeadByContact(businessSlug, contact);
    return row ? fromRow(row) : null;
  }

  async getById(id: string): Promise<Lead | null> {
    const row = await this.db.selectLeadById(id);
    return row ? fromRow(row) : null;
  }

  async save(lead: Lead): Promise<Lead> {
    await this.db.upsertLead(toRow(lead, this.negocioId));
    return lead;
  }

  async list(businessSlug?: string): Promise<Lead[]> {
    const rows = await this.db.listLeads(businessSlug);
    return rows.map(fromRow);
  }
}
