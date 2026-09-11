/**
 * Contrato de almacenamiento de leads.
 *
 * El motor y la capa web hablan SOLO con esta interfaz, nunca con un backend
 * concreto. Hoy hay un adaptador por archivo JSON; mañana puede haber uno de
 * Google Sheets, Airtable o una base de datos, sin tocar el resto del sistema.
 */

import type { Lead } from "@/core/types";

export interface LeadRepository {
  /** Devuelve el lead de un contacto en un negocio, o `null` si no existe. */
  findByContact(businessSlug: string, contact: string): Promise<Lead | null>;

  /** Devuelve un lead por su id, o `null`. */
  getById(id: string): Promise<Lead | null>;

  /** Crea o actualiza un lead (upsert por `id`). Devuelve el lead guardado. */
  save(lead: Lead): Promise<Lead>;

  /**
   * Lista los leads. Si se pasa `businessSlug`, filtra por negocio.
   * Orden sugerido: más recientes primero.
   */
  list(businessSlug?: string): Promise<Lead[]>;
}
