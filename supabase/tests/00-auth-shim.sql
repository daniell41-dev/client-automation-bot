-- ═══════════════════════════════════════════════════════════════════════════
-- Shim de Supabase para correr las migraciones REALES contra un Postgres
-- corriente en el test de RLS (`rls.test.ts`).
--
-- Un proyecto de Supabase real ya trae el schema `auth` (con `auth.users` y
-- `auth.uid()`, que lee el JWT de la request) y los roles `authenticated`/
-- `anon` con los que PostgREST ejecuta las queries. Acá se recrea lo MÍNIMO
-- que las políticas de 0001/0002/0003 necesitan para poder probarlas de
-- verdad, sin levantar el stack completo de Supabase.
--
-- Esto NO es schema de producción — solo existe para el test. `auth.uid()`
-- simula el JWT leyendo un GUC de sesión que el test fija por conexión:
--   select set_config('request.jwt.claim.sub', '<uuid-del-usuario>', false);
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  -- Permite que el rol de conexión (el que corrió las migraciones) haga
  -- `set role authenticated|anon` sin ser superusuario.
  execute format('grant authenticated, anon to %I', current_user);
end $$;
