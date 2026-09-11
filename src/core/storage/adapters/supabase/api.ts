/**
 * Acceso a Supabase para el bot, detrás de una interfaz angosta.
 *
 * Igual que `SheetsApi` en adapters/google: los repositorios dependen de
 * `SupabaseDb` (operaciones concretas), no del query builder de supabase-js,
 * para poder testearlos con un fake en memoria sin red.
 *
 * Usa la SERVICE ROLE key (el webhook no tiene sesión de usuario); RLS
 * protege el acceso web, no este camino.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** Fila de la tabla `leads` (snake_case, como en la migración). */
export interface LeadRow {
  id: string;
  business_slug: string;
  channel: string;
  contact: string;
  name: string | null;
  service_id: string | null;
  tentative_date: string | null;
  state: string;
  stage: string;
  created_at: string;
  updated_at: string;
  last_inbound_at: string;
  follow_ups_sent: string[];
  notes: string | null;
  /**
   * FK de conveniencia a `negocios.id` (T-08): `business_slug` sigue siendo
   * lo que usan el motor y las políticas de RLS. `null`/ausente cuando el
   * negocio vive solo en el registry estático de código (sin fila en
   * `negocios`) — ver el comentario de la migración 0006.
   */
  negocio_id?: string | null;
}

/** Fila de la tabla `sesiones`. */
export interface SessionRow {
  business_slug: string;
  contact: string;
  channel: string;
  history: unknown[];
  updated_at: string;
  /** Igual criterio que `LeadRow.negocio_id` — ver ese comentario. */
  negocio_id?: string | null;
}

/** Fila de la tabla `negocios` (lo que necesita el resolver del bot). */
export interface NegocioRow {
  /**
   * UUID de la fila. Opcional en el tipo (no en la tabla real) para no
   * obligar a cada fixture de test a inventarlo — `resolve.ts` lo necesita
   * para atribuir el consumo de IA (T-07) a un negocio concreto en `uso_ia`.
   */
  id?: string;
  slug: string;
  config: unknown;
  whatsapp_phone_number_id: string | null;
  es_demo: boolean;
}

/** Operaciones mínimas sobre la base que necesitan los adaptadores del bot. */
export interface SupabaseDb {
  selectLeadByContact(businessSlug: string, contact: string): Promise<LeadRow | null>;
  selectLeadById(id: string): Promise<LeadRow | null>;
  upsertLead(row: LeadRow): Promise<void>;
  listLeads(businessSlug?: string): Promise<LeadRow[]>;
  selectSession(businessSlug: string, contact: string, channel: string): Promise<SessionRow | null>;
  upsertSession(row: SessionRow): Promise<void>;
  selectNegocioBySlug(slug: string): Promise<NegocioRow | null>;
  selectNegocioByPhoneNumberId(id: string): Promise<NegocioRow | null>;
  /**
   * Reclama un `message.id` de WhatsApp. `true` la primera vez, `false` si ya
   * estaba reclamado. Atómico vía la restricción `unique` de la tabla
   * `mensajes_procesados` (migración 0004): el INSERT gana o pierde la
   * carrera, nunca hay una ventana de "leer y después escribir".
   */
  claimMessage(messageId: string): Promise<boolean>;
  /**
   * Suma un delta de consumo de IA a la fila del día para
   * (negocio_id, proveedor) — ver migración 0005. Atómico vía la función
   * `registrar_uso_ia` (upsert con incremento en la base), no leer-sumar-
   * escribir desde acá: dos llamadas concurrentes del mismo negocio no
   * pueden pisarse el contador.
   */
  recordAiUsage(entry: {
    negocioId: string;
    proveedor: string;
    llamadas?: number;
    tokensIn?: number;
    tokensOut?: number;
    fallbacks?: number;
  }): Promise<void>;
}

/** Implementación real sobre supabase-js. */
class RealSupabaseDb implements SupabaseDb {
  constructor(private readonly client: NonNullable<ReturnType<typeof createAdminClient>>) {}

  async selectLeadByContact(businessSlug: string, contact: string): Promise<LeadRow | null> {
    const { data, error } = await this.client
      .from("leads")
      .select("*")
      .eq("business_slug", businessSlug)
      .eq("contact", contact)
      .maybeSingle();
    if (error) throw error;
    return (data as LeadRow | null) ?? null;
  }

  async selectLeadById(id: string): Promise<LeadRow | null> {
    const { data, error } = await this.client
      .from("leads")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as LeadRow | null) ?? null;
  }

  async upsertLead(row: LeadRow): Promise<void> {
    const { error } = await this.client.from("leads").upsert(row, { onConflict: "id" });
    if (error) throw error;
  }

  async listLeads(businessSlug?: string): Promise<LeadRow[]> {
    let query = this.client
      .from("leads")
      .select("*")
      .order("updated_at", { ascending: false });
    if (businessSlug) query = query.eq("business_slug", businessSlug);
    const { data, error } = await query;
    if (error) throw error;
    return (data as LeadRow[] | null) ?? [];
  }

  async selectSession(
    businessSlug: string,
    contact: string,
    channel: string,
  ): Promise<SessionRow | null> {
    const { data, error } = await this.client
      .from("sesiones")
      .select("*")
      .eq("business_slug", businessSlug)
      .eq("contact", contact)
      .eq("channel", channel)
      .maybeSingle();
    if (error) throw error;
    return (data as SessionRow | null) ?? null;
  }

  async upsertSession(row: SessionRow): Promise<void> {
    const { error } = await this.client
      .from("sesiones")
      .upsert(row, { onConflict: "business_slug,contact,channel" });
    if (error) throw error;
  }

  async selectNegocioBySlug(slug: string): Promise<NegocioRow | null> {
    const { data, error } = await this.client
      .from("negocios")
      .select("id, slug, config, whatsapp_phone_number_id, es_demo")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return (data as NegocioRow | null) ?? null;
  }

  async selectNegocioByPhoneNumberId(id: string): Promise<NegocioRow | null> {
    const { data, error } = await this.client
      .from("negocios")
      .select("id, slug, config, whatsapp_phone_number_id, es_demo")
      .eq("whatsapp_phone_number_id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as NegocioRow | null) ?? null;
  }

  async claimMessage(messageId: string): Promise<boolean> {
    const { error } = await this.client
      .from("mensajes_procesados")
      .insert({ message_id: messageId });
    if (!error) return true;
    if (error.code === "23505") return false; // ya reclamado (unique_violation)
    throw error;
  }

  async recordAiUsage(entry: {
    negocioId: string;
    proveedor: string;
    llamadas?: number;
    tokensIn?: number;
    tokensOut?: number;
    fallbacks?: number;
  }): Promise<void> {
    const { error } = await this.client.rpc("registrar_uso_ia", {
      p_negocio_id: entry.negocioId,
      p_proveedor: entry.proveedor,
      p_llamadas: entry.llamadas ?? 0,
      p_tokens_in: entry.tokensIn ?? 0,
      p_tokens_out: entry.tokensOut ?? 0,
      p_fallbacks: entry.fallbacks ?? 0,
    });
    if (error) throw error;
  }
}

/**
 * Devuelve el acceso a Supabase, o `null` si no hay credenciales configuradas
 * (el factory cae entonces a Google Sheets o JSON local).
 */
export function createSupabaseDb(): SupabaseDb | null {
  const client = createAdminClient();
  return client ? new RealSupabaseDb(client) : null;
}
