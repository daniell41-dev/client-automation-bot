/**
 * Selección del backend de almacenamiento.
 *
 * Prioridad: Supabase (almacén global del SaaS) > Google Sheets del negocio
 * (multi-tenant: cada negocio puede tener su propia planilla via
 * `business.storage.spreadsheetId`) > JSON local (fallback sin credenciales).
 * Igual que con `GROQ_API_KEY`, el bot funciona sin configurar nada.
 */

import type { BusinessConfig } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { SessionRepository } from "@/core/storage/session-repository";
import type { MessageDedupeRepository } from "@/core/storage/dedupe-repository";
import type { AiUsageRepository } from "@/core/storage/usage-repository";
import type { CalendarApi } from "@/core/storage/adapters/google/calendar";
import { JsonLeadRepository } from "@/core/storage/adapters/json";
import { SessionJsonRepository } from "@/core/storage/adapters/session-json";
import { JsonMessageDedupeRepository } from "@/core/storage/adapters/dedupe-json";
import { JsonAiUsageRepository } from "@/core/storage/adapters/usage-json";
import { createSheetsApi } from "@/core/storage/adapters/google/auth";
import { createCalendarApi } from "@/core/storage/adapters/google/calendar";
import { GoogleSheetsLeadRepository } from "@/core/storage/adapters/google/leads";
import { GoogleSheetsSessionRepository } from "@/core/storage/adapters/google/sessions";
import { createSupabaseDb } from "@/core/storage/adapters/supabase/api";
import { SupabaseLeadRepository } from "@/core/storage/adapters/supabase/leads";
import { SupabaseSessionRepository } from "@/core/storage/adapters/supabase/sessions";
import { SupabaseMessageDedupeRepository } from "@/core/storage/adapters/supabase/dedupe";
import { SupabaseAiUsageRepository } from "@/core/storage/adapters/supabase/usage";

/**
 * Repositorio de leads: Supabase > Sheets del negocio > JSON local.
 *
 * `negocioId` (T-08) es el `id` real de `negocios` — lo usa el adaptador de
 * Supabase para completar la FK de conveniencia `leads.negocio_id`. `undefined`
 * cuando el negocio vive solo en el registry estático (sin fila en `negocios`).
 */
export function createLeadRepository(
  business?: BusinessConfig,
  negocioId?: string,
): LeadRepository {
  const db = createSupabaseDb();
  if (db) return new SupabaseLeadRepository(db, negocioId);
  const sheets = createSheetsApi(business?.storage?.spreadsheetId);
  return sheets
    ? new GoogleSheetsLeadRepository(sheets)
    : new JsonLeadRepository();
}

/** Repositorio de sesiones: Supabase > Sheets del negocio > JSON local. Ver `negocioId` en `createLeadRepository`. */
export function createSessionRepository(
  business?: BusinessConfig,
  negocioId?: string,
): SessionRepository {
  const db = createSupabaseDb();
  if (db) return new SupabaseSessionRepository(db, negocioId);
  const sheets = createSheetsApi(business?.storage?.spreadsheetId);
  return sheets
    ? new GoogleSheetsSessionRepository(sheets)
    : new SessionJsonRepository();
}

/**
 * Cliente de calendario del negocio, o `null` si no tiene `calendarId` configurado
 * o no hay credenciales de service account. Sin esto, no se agendan eventos.
 */
export function createCalendar(business: BusinessConfig): CalendarApi | null {
  return createCalendarApi(business.storage?.calendarId);
}

/**
 * Repositorio de idempotencia por `message.id`: Supabase (atómico, real por
 * `unique`) > JSON local. Sin Sheets: un `message.id` es global, no por
 * negocio, y esto es bookkeeping técnico, no un dato que un negocio necesite
 * ver en su propia planilla.
 */
export function createMessageDedupeRepository(): MessageDedupeRepository {
  const db = createSupabaseDb();
  return db ? new SupabaseMessageDedupeRepository(db) : new JsonMessageDedupeRepository();
}

/**
 * Repositorio de consumo de IA (T-07): Supabase > JSON local. Sin Sheets, por
 * el mismo motivo que el dedupe de mensajes: es bookkeeping técnico, no un
 * dato que un negocio necesite ver en su propia planilla.
 */
export function createAiUsageRepository(): AiUsageRepository {
  const db = createSupabaseDb();
  return db ? new SupabaseAiUsageRepository(db) : new JsonAiUsageRepository();
}
