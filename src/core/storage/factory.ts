/**
 * Selección del backend de almacenamiento.
 *
 * Si hay credenciales de Google Sheets configuradas Y el negocio tiene un
 * spreadsheetId en su config, usa los adaptadores de Sheets para ese negocio.
 * Si no, cae a los adaptadores JSON locales (degradación elegante).
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

/** Repositorio de leads: Google Sheets del negocio si está configurado, si no JSON local. */
export function createLeadRepository(business: BusinessConfig): LeadRepository {
  const sheets = createSheetsApi(business.storage?.spreadsheetId);
  return sheets
    ? new GoogleSheetsLeadRepository(sheets)
    : new JsonLeadRepository();
}

/** Repositorio de sesiones: Google Sheets del negocio si está configurado, si no JSON local. */
export function createSessionRepository(business: BusinessConfig): SessionRepository {
  const sheets = createSheetsApi(business.storage?.spreadsheetId);
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
