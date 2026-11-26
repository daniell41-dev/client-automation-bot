-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0032: plan comercial de cada negocio (T-127).
--
-- Tres planes, de menor a mayor: 'plus' < 'pro' < 'premium' (ver
-- src/core/planes.ts). Todos los negocios, los que ya existen y los nuevos,
-- empiezan en 'plus'; el admin los sube desde el back office.
--
-- Columna propia y no dentro de `config` (JSONB): la política `negocios_own`
-- (0003) deja que la dueña actualice SU fila completa, así que un plan
-- guardado en el config lo podía cambiar ella misma llamando a la API de
-- Supabase con su sesión. Por eso, además, un trigger rechaza cualquier
-- cambio de `plan` que no venga del admin o del servidor (service role).
--
-- La etiqueta vieja `config.plan` ('free'/'pro') deja de usarse: no se
-- migra porque nunca limitó nada y la decisión es que todos arranquen en Plus.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0031.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.negocios
  add column if not exists plan text not null default 'plus'
    check (plan in ('plus', 'pro', 'premium'));

-- Solo el admin (o el servidor con service role) cambia el plan. Una dueña
-- que crea su propio negocio (portal → primer negocio) siempre nace en Plus,
-- aunque mande otro valor. `auth.role()` vacío = conexión directa a la base
-- (SQL Editor del dashboard), que solo tiene quien administra el proyecto.
create or replace function public.proteger_plan_negocio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('service_role', '') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'plus';
  elsif new.plan is distinct from old.plan then
    raise exception 'Solo el administrador puede cambiar el plan del negocio.';
  end if;
  return new;
end;
$$;

drop trigger if exists negocios_proteger_plan on public.negocios;
create trigger negocios_proteger_plan
  before insert or update on public.negocios
  for each row execute function public.proteger_plan_negocio();
