/**
 * Contrato de almacenamiento de memoria de sesión.
 * Intercambiable igual que LeadRepository.
 */

import type { Channel, SessionMemory } from "@/core/types";

export interface SessionRepository {
  /**
   * Devuelve la sesión existente o crea una vacía sin persistir.
   */
  getOrCreate(
    businessSlug: string,
    contact: string,
    channel: Channel,
  ): Promise<SessionMemory>;

  /** Persiste la sesión (upsert). */
  save(session: SessionMemory): Promise<void>;
}
