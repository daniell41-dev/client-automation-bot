-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0004: idempotencia por mensaje entrante (message.id de WhatsApp).
--
-- T-05: el webhook ahora responde 200 a Meta ANTES de procesar el mensaje
-- (ver src/app/api/webhook/whatsapp/route.ts). Aun así Meta puede reintentar
-- una entrega (red lenta, etc.) mandando el MISMO message.id — sin esto, el
-- motor lo procesaría de nuevo y el cliente recibiría la respuesta duplicada.
--
-- La restricción `unique` (la primary key) es lo que hace atómico el
-- "reclamo" del mensaje: dos llamadas concurrentes con el mismo message_id
-- nunca pueden insertar las dos, sin necesidad de un read-then-write
-- separado (ver `claimMessage` en `storage/adapters/supabase/api.ts`).
--
-- Solo el bot (service role, bypassa RLS) necesita tocar esta tabla — no es
-- dato de negocio, así que no lleva políticas para `authenticated`/`anon`;
-- RLS habilitada sin políticas equivale a "nadie más puede leerla ni
-- escribirla".
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001, 0002
-- y 0003.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.mensajes_procesados (
  message_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.mensajes_procesados enable row level security;
