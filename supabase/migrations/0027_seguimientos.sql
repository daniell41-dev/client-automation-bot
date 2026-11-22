-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0027: seguimiento automático de pedidos a medias (T-106).
--
-- El cron del VPS llama a /api/cron/seguimientos cada 15 minutos; la ruta
-- busca leads con un pedido sin cerrar y, si toca, les escribe (máximo 2 por
-- cada silencio del cliente, dentro de las 24 h de WhatsApp). Ver
-- src/core/engine/seguimientos.ts.
--
--   no_contactar: el cliente pidió "no me escriban". No recibe más
--                 seguimientos automáticos; si escribe, se le atiende igual.
--
-- El índice cubre la consulta de la ruta: leads de un negocio que
-- escribieron en las últimas 24 h.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0025.
-- (0026 quedó reservada para T-104, que no la necesitó.)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leads
  add column if not exists no_contactar boolean not null default false;

create index if not exists leads_negocio_ultimo_mensaje
  on public.leads (business_slug, last_inbound_at desc);
