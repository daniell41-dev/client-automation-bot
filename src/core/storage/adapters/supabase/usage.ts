/**
 * Adaptador de consumo de IA sobre Supabase (T-07). Traduce `AiUsageEntry`
 * (donde `negocio` es el UUID del negocio) a `recordAiUsage` de `SupabaseDb`.
 */

import type { AiUsageEntry, AiUsageRepository } from "@/core/storage/usage-repository";
import type { SupabaseDb } from "@/core/storage/adapters/supabase/api";

export class SupabaseAiUsageRepository implements AiUsageRepository {
  constructor(private readonly db: SupabaseDb) {}

  async registrar(entry: AiUsageEntry): Promise<void> {
    await this.db.recordAiUsage({
      negocioId: entry.negocio,
      proveedor: entry.proveedor,
      llamadas: entry.llamadas,
      tokensIn: entry.tokensIn,
      tokensOut: entry.tokensOut,
      fallbacks: entry.fallbacks,
    });
  }
}
