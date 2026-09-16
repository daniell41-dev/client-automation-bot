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
import type { InventoryRepository } from "@/core/storage/inventory-repository";
import type { ComprobanteRepository } from "@/core/storage/comprobante-repository";
import type { PaymentGateway } from "@/core/payments/gateway";
import type { CalendarApi } from "@/core/storage/adapters/google/calendar";
import { JsonLeadRepository } from "@/core/storage/adapters/json";
import { SessionJsonRepository } from "@/core/storage/adapters/session-json";
import { JsonMessageDedupeRepository } from "@/core/storage/adapters/dedupe-json";
import { JsonAiUsageRepository } from "@/core/storage/adapters/usage-json";
import { JsonInventoryRepository } from "@/core/storage/adapters/inventory-json";
import { JsonComprobanteRepository } from "@/core/storage/adapters/comprobante-json";
import { createSheetsApi } from "@/core/storage/adapters/google/auth";
import { createCalendarApi } from "@/core/storage/adapters/google/calendar";
import { GoogleSheetsLeadRepository } from "@/core/storage/adapters/google/leads";
import { GoogleSheetsSessionRepository } from "@/core/storage/adapters/google/sessions";
import { createSupabaseDb } from "@/core/storage/adapters/supabase/api";
import { SupabaseLeadRepository } from "@/core/storage/adapters/supabase/leads";
import { SupabaseSessionRepository } from "@/core/storage/adapters/supabase/sessions";
import { SupabaseMessageDedupeRepository } from "@/core/storage/adapters/supabase/dedupe";
import { SupabaseAiUsageRepository } from "@/core/storage/adapters/supabase/usage";
import { SupabaseInventoryRepository } from "@/core/storage/adapters/supabase/inventory";
import { SupabaseComprobanteRepository } from "@/core/storage/adapters/supabase/comprobantes";
import { WompiGateway } from "@/core/payments/wompi";

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

/**
 * Repositorio de stock (T-21): Supabase (descuento atómico real, ver
 * migración 0010) > JSON local (leer-restar-escribir, sin garantía de
 * concurrencia — suficiente para desarrollo de un solo proceso). Sin Sheets,
 * mismo motivo que el resto del bookkeeping técnico: no es un dato que un
 * negocio necesite ver en su propia planilla.
 */
export function createInventoryRepository(): InventoryRepository {
  const db = createSupabaseDb();
  return db ? new SupabaseInventoryRepository(db) : new JsonInventoryRepository();
}

/**
 * Repositorio de comprobantes de pago (T-24.1): Supabase (referencia única
 * real, ver migración 0013) > JSON local. Sin Sheets, mismo motivo que el
 * resto del bookkeeping técnico.
 */
export function createComprobanteRepository(): ComprobanteRepository {
  const db = createSupabaseDb();
  return db ? new SupabaseComprobanteRepository(db) : new JsonComprobanteRepository();
}

/**
 * Pasarela de pago Nivel 2 (T-24.5). `null` si el negocio no tiene Wompi
 * configurado (columnas propias de `negocios`, migración 0014 — NUNCA en
 * `negocios.config`, ver el comentario en `types.ts#PagosConfig.wompi`) o si
 * no hay Supabase: Nivel 2 requiere una cuenta de comercio real, no existe
 * un fallback JSON para esto.
 */
export async function createPaymentGateway(negocioId: string | undefined): Promise<PaymentGateway | null> {
  if (!negocioId) return null;
  const db = createSupabaseDb();
  if (!db) return null;
  const credenciales = await db.selectWompiCredentials(negocioId);
  if (!credenciales) return null;
  return new WompiGateway({ publicKey: credenciales.publicKey, integritySecret: credenciales.integritySecret });
}

/**
 * Solo el secreto de eventos del negocio, para verificar la firma de un
 * webhook de Wompi — separado de `createPaymentGateway` porque el webhook
 * necesita este único valor antes de saber si vale la pena armar el resto.
 */
export async function getWompiEventsSecret(negocioId: string | undefined): Promise<string | null> {
  if (!negocioId) return null;
  const db = createSupabaseDb();
  if (!db) return null;
  const credenciales = await db.selectWompiCredentials(negocioId);
  return credenciales?.eventsSecret ?? null;
}
