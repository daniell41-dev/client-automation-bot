-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0020: aviso en modo "solo resumen" (T-39).
--
-- En un día pico, un mensaje por pedido entierra a la dueña. En modo resumen
-- el bot le manda a lo sumo UN aviso cada N minutos ("tenés 6 pedidos por
-- verificar → panel"). Para eso hace falta saber cuándo fue el último, y
-- decidir "¿toca mandar otro?" de forma atómica: dos pedidos que entran en el
-- mismo segundo no pueden mandar dos resúmenes.
--
-- Vive en `pedido_contadores` (0015), que ya es una fila por negocio que solo
-- toca el bot — no en `negocios`, que la dueña reescribe desde el portal.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0019.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pedido_contadores
  add column ultimo_resumen_at timestamptz;

-- `true` si corresponde mandar un resumen ahora (y lo deja marcado); `false`
-- si ya se mandó uno hace menos de `p_minutos`.
create or replace function public.reclamar_aviso_resumen(
  p_negocio_id uuid,
  p_minutos int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reclamado boolean;
begin
  insert into public.pedido_contadores as c (negocio_id, ultimo, ultimo_resumen_at)
  values (p_negocio_id, 0, now())
  on conflict (negocio_id) do update
    set ultimo_resumen_at = now()
    where c.ultimo_resumen_at is null
       or c.ultimo_resumen_at < now() - make_interval(mins => p_minutos)
  returning true into reclamado;
  return coalesce(reclamado, false);
end;
$$;

revoke execute on function public.reclamar_aviso_resumen(uuid, int)
  from public, anon, authenticated;
grant execute on function public.reclamar_aviso_resumen(uuid, int)
  to service_role;
