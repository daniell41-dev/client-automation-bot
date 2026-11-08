/** T-59: la última vez que escribió la dueña, en `negocios.duena_escribio_at` (migración 0023). */
import type { SupabaseDb } from "@/core/storage/adapters/supabase/api";
import type { VentanaDuenaRepository } from "@/core/storage/ventana-duena-repository";

export class SupabaseVentanaDuenaRepository implements VentanaDuenaRepository {
  constructor(private readonly db: SupabaseDb) {}

  async registrarMensaje(negocio: string, cuando: Date): Promise<void> {
    await this.db.updateDuenaEscribio(negocio, cuando.toISOString());
  }

  async ultimoMensaje(negocio: string): Promise<string | undefined> {
    return (await this.db.selectDuenaEscribio(negocio)) ?? undefined;
  }
}
