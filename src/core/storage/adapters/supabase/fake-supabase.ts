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

interface FakeSupabaseDb extends SupabaseDb {
  /** Acceso directo a las filas para asserts y seeding en tests. */
  leads: LeadRow[];
  sesiones: SessionRow[];
  negocios: NegocioRow[];
  mensajesProcesados: Set<string>;
}

export function makeFakeSupabaseDb(): FakeSupabaseDb {
  const leads: LeadRow[] = [];
  const sesiones: SessionRow[] = [];
  const negocios: NegocioRow[] = [];
  const mensajesProcesados = new Set<string>();

  return {
    leads,
    sesiones,
    negocios,
    mensajesProcesados,

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
  };
}
