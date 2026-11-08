-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0021: medidor de mensajes de WhatsApp por negocio y por mes (T-43).
--
-- Desde oct-2026 Meta cobra los mensajes pasado un cupo mensual, y las
-- plantillas siempre. Sin este conteo no se sabe cuánto cuesta cada negocio
-- ni dónde poner los límites de los planes (docs/14 §4-ter, "Precio").
--
-- Una fila por (negocio, mes). Se acumula con `registrar_uso_whatsapp` en
-- vez de leer-sumar-escribir desde la app, igual que `registrar_uso_ia`
-- (0005): dos mensajes simultáneos del mismo negocio no se pisan.
--
-- El mes se calcula en hora de Colombia: un mensaje del 31 a las 9 p. m. ya
-- es día 1 en UTC, pero la dueña (y la factura de Meta que se compara) lo
-- ven en el mes anterior.
--
-- Escribe solo el bot (service role, vía la función). Lee el admin desde el
-- back office; la dueña no ve esta tabla.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0020.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.uso_whatsapp (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  mes date not null,
  recibidos int not null default 0,
  enviados int not null default 0,   -- texto libre o con botones, aceptado por Meta
  plantillas int not null default 0, -- plantillas aprobadas (siempre pagas)
  primary key (negocio_id, mes)
);

alter table public.uso_whatsapp enable row level security;

create policy uso_whatsapp_admin on public.uso_whatsapp
  for select using (public.is_admin());

create or replace function public.registrar_uso_whatsapp(
  p_negocio_id uuid,
  p_recibidos int default 0,
  p_enviados int default 0,
  p_plantillas int default 0
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.uso_whatsapp (negocio_id, mes, recibidos, enviados, plantillas)
  values (
    p_negocio_id,
    date_trunc('month', now() at time zone 'America/Bogota')::date,
    p_recibidos, p_enviados, p_plantillas
  )
  on conflict (negocio_id, mes) do update set
    recibidos = public.uso_whatsapp.recibidos + excluded.recibidos,
    enviados = public.uso_whatsapp.enviados + excluded.enviados,
    plantillas = public.uso_whatsapp.plantillas + excluded.plantillas;
$$;

-- Con la anon key cualquiera podría inflarle el contador a un negocio ajeno.
revoke execute on function public.registrar_uso_whatsapp(uuid, int, int, int)
  from public, anon, authenticated;
grant execute on function public.registrar_uso_whatsapp(uuid, int, int, int)
  to service_role;
