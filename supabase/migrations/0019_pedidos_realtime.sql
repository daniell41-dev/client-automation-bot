-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0019: el panel de pedidos se actualiza solo (T-38c).
--
-- Supabase Realtime solo emite cambios de las tablas agregadas a su
-- publicación. Los eventos respetan RLS (`pedidos_own`): cada dueña recibe
-- solo los de sus negocios.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0018.
-- ═══════════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table public.pedidos;
