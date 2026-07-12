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
import type { CalendarApi } from "@/core/storage/adapters/google/calendar";
import { JsonLeadRepository } from "@/core/storage/adapters/json";
import { SessionJsonRepository } from "@/core/storage/adapters/session-json";
import { createSheetsApi } from "@/core/storage/adapters/google/auth";
import { createCalendarApi } from "@/core/storage/adapters/google/calendar";
import { GoogleSheetsLeadRepository } from "@/core/storage/adapters/google/leads";
import { GoogleSheetsSessionRepository } from "@/core/storage/adapters/google/sessions";
import { createSupabaseDb } from "@/core/storage/adapters/supabase/api";
import { SupabaseLeadRepository } from "@/core/storage/adapters/supabase/leads";
import { SupabaseSessionRepository } from "@/core/storage/adapters/supabase/sessions";

/** Repositorio de leads: Supabase > Sheets del negocio > JSON local. */
export function createLeadRepository(business?: BusinessConfig): LeadRepository {
  const db = createSupabaseDb();
  if (db) return new SupabaseLeadRepository(db);
  const sheets = createSheetsApi(business?.storage?.spreadsheetId);
  return sheets
    ? new GoogleSheetsLeadRepository(sheets)
    : new JsonLeadRepository();
}

/** Repositorio de sesiones: Supabase > Sheets del negocio > JSON local. */
export function createSessionRepository(
  business?: BusinessConfig,
): SessionRepository {
  const db = createSupabaseDb();
  if (db) return new SupabaseSessionRepository(db);
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
