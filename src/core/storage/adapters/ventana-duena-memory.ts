/**
 * T-59: fallback sin Supabase (desarrollo local). En memoria: un reinicio la
 * deja "cerrada", lo que solo hace que el próximo aviso salga con plantilla.
 */
import type { VentanaDuenaRepository } from "@/core/storage/ventana-duena-repository";

const ultimos = new Map<string, string>();

export class MemoryVentanaDuenaRepository implements VentanaDuenaRepository {
  async registrarMensaje(negocio: string, cuando: Date): Promise<void> {
    ultimos.set(negocio, cuando.toISOString());
  }

  async ultimoMensaje(negocio: string): Promise<string | undefined> {
    return ultimos.get(negocio);
  }
}
