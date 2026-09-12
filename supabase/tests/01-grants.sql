-- ═══════════════════════════════════════════════════════════════════════════
-- Grants que en un proyecto de Supabase real ya vienen dados para
-- authenticated/anon. Corre DESPUÉS de las migraciones (necesita que las
-- tablas ya existan).
--
-- Sin esto RLS no quedaría probado de verdad por dos motivos: el rol que
-- corrió las migraciones es el DUEÑO de las tablas y ese siempre bypassa RLS
-- (con o sin políticas), y sin GRANT los roles authenticated/anon ni
-- siquiera podrían intentar la query — fallarían por falta de permiso, un
-- error distinto al que este test quiere demostrar (violación de política).
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public, auth to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on all functions in schema public, auth to authenticated, anon;
