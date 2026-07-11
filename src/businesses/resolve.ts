/**
 * Resolución dinámica de negocios.
 *
 * El SaaS guarda los negocios en Supabase (tabla `negocios`, config en JSONB).
 * Estas funciones async buscan primero en la base y, si no hay Supabase
 * configurado o no existe la fila, caen al registry estático de código
 * (`registry.ts`), que sigue siendo la fuente en desarrollo sin credenciales.
 *
 * El motor (`handleIncoming`) no cambia: recibe el `BusinessConfig` resuelto.
 */

import type { BusinessConfig } from "@/core/types";
import { parseBusinessConfig } from "@/core/config-schema";
import { createSupabaseDb } from "@/core/storage/adapters/supabase/api";
import {
  getBusinessBySlug,
  getBusinessByPhoneNumberId,
} from "@/businesses/registry";

/** Info extra del negocio que necesita la capa web (no el motor). */
export interface ResolvedBusiness {
  config: BusinessConfig;
  /** `true` si es el negocio de demostración pública. */
  esDemo: boolean;
}

/** Busca por slug: Supabase primero, registry estático como fallback. */
export async function resolveBusinessBySlug(
  slug: string,
): Promise<ResolvedBusiness | null> {
  const db = createSupabaseDb();
  if (db) {
    const row = await db.selectNegocioBySlug(slug);
    if (row) {
      const config = parseBusinessConfig(row.config);
      if (config) return { config, esDemo: row.es_demo };
      console.warn(`[resolve] config inválida en DB para negocio "${slug}"`);
    }
  }
  const fallback = getBusinessBySlug(slug);
  return fallback ? { config: fallback, esDemo: false } : null;
}

/** Busca por phone_number_id de WhatsApp: Supabase primero, registry después. */
export async function resolveBusinessByPhoneNumberId(
  phoneNumberId: string,
): Promise<ResolvedBusiness | null> {
  const db = createSupabaseDb();
  if (db) {
    const row = await db.selectNegocioByPhoneNumberId(phoneNumberId);
    if (row) {
      const config = parseBusinessConfig(row.config);
      if (config) return { config, esDemo: row.es_demo };
      console.warn(
        `[resolve] config inválida en DB para phone_number_id "${phoneNumberId}"`,
      );
    }
  }
  const fallback = getBusinessByPhoneNumberId(phoneNumberId);
  return fallback ? { config: fallback, esDemo: false } : null;
}
