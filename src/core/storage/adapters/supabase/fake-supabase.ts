/**
 * Fake en memoria de `SupabaseDb` para tests (sin red ni credenciales).
 * Espejo del patrón `fake-sheets.ts` del adaptador de Google.
 */

import type {
  LeadRow,
  NegocioRow,
  SessionRow,
  SupabaseDb,
} from "@/core/storage/adapters/supabase/api";

/** Fila acumulada de `uso_ia`, espejo de la migración 0005. */
interface UsoIaRow {
  negocio_id: string;
  proveedor: string;
  llamadas: number;
  tokens_in: number;
  tokens_out: number;
  fallbacks: number;
}

interface FakeSupabaseDb extends SupabaseDb {
  /** Acceso directo a las filas para asserts y seeding en tests. */
  leads: LeadRow[];
  sesiones: SessionRow[];
  negocios: NegocioRow[];
  mensajesProcesados: Set<string>;
  usoIa: UsoIaRow[];
}

export function makeFakeSupabaseDb(): FakeSupabaseDb {
  const leads: LeadRow[] = [];
  const sesiones: SessionRow[] = [];
  const negocios: NegocioRow[] = [];
  const mensajesProcesados = new Set<string>();
  const usoIa: UsoIaRow[] = [];

  return {
    leads,
    sesiones,
    negocios,
    mensajesProcesados,
    usoIa,

    async selectLeadByContact(businessSlug, contact) {
      return (
        leads.find(
          (l) => l.business_slug === businessSlug && l.contact === contact,
        ) ?? null
      );
    },

    async selectLeadById(id) {
      return leads.find((l) => l.id === id) ?? null;
    },

    async upsertLead(row) {
      const i = leads.findIndex((l) => l.id === row.id);
      if (i >= 0) leads[i] = { ...row };
      else leads.push({ ...row });
    },

    async listLeads(businessSlug) {
      const filtered = businessSlug
        ? leads.filter((l) => l.business_slug === businessSlug)
        : leads;
      return [...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async selectSession(businessSlug, contact, channel) {
      return (
        sesiones.find(
          (s) =>
            s.business_slug === businessSlug &&
            s.contact === contact &&
            s.channel === channel,
        ) ?? null
      );
    },

    async upsertSession(row) {
      const i = sesiones.findIndex(
        (s) =>
          s.business_slug === row.business_slug &&
          s.contact === row.contact &&
          s.channel === row.channel,
      );
      if (i >= 0) sesiones[i] = { ...row };
      else sesiones.push({ ...row });
    },

    async selectNegocioBySlug(slug) {
      return negocios.find((n) => n.slug === slug) ?? null;
    },

    async selectNegocioByPhoneNumberId(id) {
      return negocios.find((n) => n.whatsapp_phone_number_id === id) ?? null;
    },

    async claimMessage(messageId) {
      if (mensajesProcesados.has(messageId)) return false;
      mensajesProcesados.add(messageId);
      return true;
    },

    async recordAiUsage(entry) {
      const fila = usoIa.find(
        (u) => u.negocio_id === entry.negocioId && u.proveedor === entry.proveedor,
      );
      const delta = {
        llamadas: entry.llamadas ?? 0,
        tokens_in: entry.tokensIn ?? 0,
        tokens_out: entry.tokensOut ?? 0,
        fallbacks: entry.fallbacks ?? 0,
      };
      if (fila) {
        fila.llamadas += delta.llamadas;
        fila.tokens_in += delta.tokens_in;
        fila.tokens_out += delta.tokens_out;
        fila.fallbacks += delta.fallbacks;
      } else {
        usoIa.push({ negocio_id: entry.negocioId, proveedor: entry.proveedor, ...delta });
      }
    },
  };
}
