/**
 * Selección del backend de almacenamiento.
 *
 * Si hay credenciales de Google Sheets configuradas, usa esos adaptadores;
 * si no, cae a los adaptadores JSON locales. Igual que con `GROQ_API_KEY`, el
 * bot sigue funcionando sin credenciales (degradación elegante).
 */

import type { LeadRepository } from "@/core/storage/repository";
import type { SessionRepository } from "@/core/storage/session-repository";
import { JsonLeadRepository } from "@/core/storage/adapters/json";
import { SessionJsonRepository } from "@/core/storage/adapters/session-json";
import { createSheetsApi } from "@/core/storage/adapters/google/auth";
import { GoogleSheetsLeadRepository } from "@/core/storage/adapters/google/leads";
import { GoogleSheetsSessionRepository } from "@/core/storage/adapters/google/sessions";

/** Repositorio de leads: Google Sheets si está configurado, si no JSON local. */
export function createLeadRepository(): LeadRepository {
  const sheets = createSheetsApi();
  return sheets
    ? new GoogleSheetsLeadRepository(sheets)
    : new JsonLeadRepository();
}

/** Repositorio de sesiones: Google Sheets si está configurado, si no JSON local. */
export function createSessionRepository(): SessionRepository {
  const sheets = createSheetsApi();
  return sheets
    ? new GoogleSheetsSessionRepository(sheets)
    : new SessionJsonRepository();
}
