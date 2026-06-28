/**
 * Adaptador de sesiones EN MEMORIA.
 * La memoria vive solo mientras existe la instancia: ideal para el simulador
 * offline y los tests, donde cada ejecución debe arrancar con historial limpio.
 *
 * Espejo en memoria de SessionJsonRepository (mismo contrato, sin disco).
 */

import type { Channel, SessionMemory } from "@/core/types";
import type { SessionRepository } from "@/core/storage/session-repository";

/** Máximo de turnos que se conservan en el historial (sliding window). */
const MAX_HISTORY = 10;

export class SessionMemoryRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionMemory>();

  private key(businessSlug: string, contact: string): string {
    return `${businessSlug}:${contact}`;
  }

  async getOrCreate(
    businessSlug: string,
    contact: string,
    channel: Channel,
  ): Promise<SessionMemory> {
    const existing = this.sessions.get(this.key(businessSlug, contact));
    if (existing) return existing;
    return {
      contact,
      businessSlug,
      channel,
      history: [],
      updatedAt: new Date().toISOString(),
    };
  }

  async save(session: SessionMemory): Promise<void> {
    const trimmed: SessionMemory = {
      ...session,
      history: session.history.slice(-MAX_HISTORY),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(this.key(session.businessSlug, session.contact), trimmed);
  }
}
