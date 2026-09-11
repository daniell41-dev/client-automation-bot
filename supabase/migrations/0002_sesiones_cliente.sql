-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0002: el cliente puede LEER las sesiones (conversaciones) de sus
-- propios negocios — necesaria para la bandeja "Conversaciones" del portal.
-- El bot sigue escribiendo con la service role (bypassa RLS).
--
-- Aplicar en el SQL Editor del dashboard de Supabase (después de la 0001).
-- ═══════════════════════════════════════════════════════════════════════════

create policy sesiones_own on public.sesiones
  for select using (public.owns_negocio(business_slug));
