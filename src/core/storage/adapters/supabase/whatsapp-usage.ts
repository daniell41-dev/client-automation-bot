/**
 * Medidor de WhatsApp sobre Supabase (T-43). El mes lo calcula la función
 * `registrar_uso_whatsapp` en la base (hora de Colombia), no este adaptador.
 */

import type { SupabaseDb } from "@/core/storage/adapters/supabase/api";
import type {
  WhatsAppUsageEntry,
  WhatsAppUsageRepository,
} from "@/core/storage/whatsapp-usage-repository";

export class SupabaseWhatsAppUsageRepository implements WhatsAppUsageRepository {
  constructor(private readonly db: SupabaseDb) {}

  async registrar(entry: WhatsAppUsageEntry): Promise<void> {
    await this.db.recordWhatsAppUsage({
      negocioId: entry.negocio,
      recibidos: entry.recibidos,
      enviados: entry.enviados,
      plantillas: entry.plantillas,
    });
  }
}
