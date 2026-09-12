/**
 * Adaptador de idempotencia sobre Supabase (Postgres) — backend principal
 * del SaaS. Espejo de `dedupe-json.ts`, pero atómico de verdad: `claim()`
 * se apoya en la restricción `unique` de `mensajes_procesados` (migración
 * 0004), no en un read-then-write.
 */

import type { MessageDedupeRepository } from "@/core/storage/dedupe-repository";
import type { SupabaseDb } from "@/core/storage/adapters/supabase/api";

export class SupabaseMessageDedupeRepository implements MessageDedupeRepository {
  constructor(private readonly db: SupabaseDb) {}

  async claim(messageId: string): Promise<boolean> {
    return this.db.claimMessage(messageId);
  }
}
