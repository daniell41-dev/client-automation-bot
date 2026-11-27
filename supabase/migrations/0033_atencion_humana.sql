-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0033: el cliente pide hablar con una persona (T-155).
--
-- Cuando un cliente escribe "quiero hablar con una persona", el asistente le
-- avisa a la dueña y deja de responder SOLO en esa conversación. También la
-- dueña puede "Tomar chat" desde Conversaciones del portal.
--
--   atencion_humana_desde: cuándo empezó la pausa. null = el asistente
--   responde. La pausa vence sola a las 12 horas (HORAS_ATENCION_HUMANA en
--   src/core/engine/atencion-humana.ts): no hace falta un cron que la limpie.
--
-- La dueña la cambia desde el portal con `leads_own_update` (0008); el bot
-- escribe con la service role.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0032.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leads
  add column if not exists atencion_humana_desde timestamptz;

-- "Le toca a usted" busca las pausas recientes de los negocios de la dueña.
create index if not exists leads_atencion_humana_idx
  on public.leads (business_slug, atencion_humana_desde)
  where atencion_humana_desde is not null;
