/**
 * Adaptador de sesiones sobre Supabase.
 *
 * Espejo de SessionJsonRepository / GoogleSheetsSessionRepository: una fila
 * por (negocio, contacto, canal) con el historial reciente (máx. 10 turnos)
 * en JSONB. Cuando el cliente vuelve a escribir, la IA recupera el contexto.
 */

import type { Channel, ConversationTurn, SessionMemory } from "@/core/types";
import type { SessionRepository } from "@/core/storage/session-repository";
import type { SupabaseDb } from "@/core/storage/adapters/supabase/api";

/** Máximo de turnos que se conservan (igual que los otros adaptadores). */
const MAX_HISTORY = 10;

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly db: SupabaseDb) {}

  async getOrCreate(
    businessSlug: string,
    contact: string,
    channel: Channel,
  ): Promise<SessionMemory> {
    const row = await this.db.selectSession(businessSlug, contact, channel);
    if (!row) {
      return {
        contact,
        businessSlug,
        channel,
        history: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      businessSlug: row.business_slug,
      contact: row.contact,
      channel: row.channel as Channel,
      history: (row.history ?? []) as ConversationTurn[],
      updatedAt: row.updated_at,
    };
  }

  async save(session: SessionMemory): Promise<void> {
    await this.db.upsertSession({
      business_slug: session.businessSlug,
      contact: session.contact,
      channel: session.channel,
      history: session.history.slice(-MAX_HISTORY),
      updated_at: new Date().toISOString(),
    });
  }
}
