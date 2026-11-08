-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0023: cuándo escribió la dueña por última vez (T-59).
--
-- WhatsApp solo entrega texto libre a quien escribió en las últimas 24h; si
-- no, hace falta una plantilla aprobada. Meta no rechaza el texto al momento
-- de enviarlo: lo acepta y después reporta que no lo entregó, así que el bot
-- tiene que saber ANTES si la ventana de la dueña está abierta para decidir
-- entre el aviso completo (gratis) o la plantilla.
--
-- Lo escribe solo el bot (service role) cuando entra un mensaje de la dueña.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0022.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.negocios
  add column if not exists duena_escribio_at timestamptz;
