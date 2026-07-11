/**
 * Selección del backend de almacenamiento.
 *
 * Prioridad: Supabase (principal del SaaS) > Google Sheets (opcional) >
 * JSON local (fallback sin credenciales). Igual que con `GROQ_API_KEY`, el
 * bot sigue funcionando sin configurar nada (degradación elegante).
 */

import type { LeadRepository } from "@/core/storage/repository";
import type { SessionRepository } from "@/core/storage/session-repository";
import { JsonLeadRepository } from "@/core/storage/adapters/json";
import { SessionJsonRepository } from "@/core/storage/adapters/session-json";
import { createSheetsApi } from "@/core/storage/adapters/google/auth";
import { GoogleSheetsLeadRepository } from "@/core/storage/adapters/google/leads";
import { GoogleSheetsSessionRepository } from "@/core/storage/adapters/google/sessions";
import { createSupabaseDb } from "@/core/storage/adapters/supabase/api";
import { SupabaseLeadRepository } from "@/core/storage/adapters/supabase/leads";
import { SupabaseSessionRepository } from "@/core/storage/adapters/supabase/sessions";

/** Repositorio de leads: Supabase > Google Sheets > JSON local. */
export function createLeadRepository(): LeadRepository {
  const db = createSupabaseDb();
  if (db) return new SupabaseLeadRepository(db);
  const sheets = createSheetsApi();
  return sheets
    ? new GoogleSheetsLeadRepository(sheets)
    : new JsonLeadRepository();
}

/** Repositorio de sesiones: Supabase > Google Sheets > JSON local. */
export function createSessionRepository(): SessionRepository {
  const db = createSupabaseDb();
  if (db) return new SupabaseSessionRepository(db);
  const sheets = createSheetsApi();
  return sheets
    ? new GoogleSheetsSessionRepository(sheets)
    : new SessionJsonRepository();
}
