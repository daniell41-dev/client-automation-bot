-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0011: alerta de stock bajo al dueño (T-22.2).
--
-- Dos piezas:
--
-- 1. `alertado_en` en `inventario`: qué día se le avisó por última vez al
--    dueño que ESTE producto quedó bajo. Sin esto, cinco ventas seguidas del
--    mismo producto bajo mandan cinco avisos y el dueño termina silenciando
--    el bot — el umbral se vuelve a cruzar en cada venta mientras el stock
--    siga bajo, así que hace falta recordar "ya avisé hoy".
--
-- 2. `marcar_alerta_stock_bajo`: atómica, mismo criterio que
--    `descontar_stock_carrito` — "¿corresponde avisar?" y "marcar que ya se
--    avisó" tienen que ser UNA sola operación en la base. Si fueran dos pasos
--    desde la app (leer `alertado_en`, decidir, escribir), dos ventas
--    casi simultáneas del mismo producto podrían leer el mismo valor viejo y
--    mandar dos alertas el mismo día.
--
-- De paso, `descontar_stock_carrito` (0010) se REEMPLAZA para devolver el
-- stock resultante de cada ítem (`restante`) — sin esto, `handle.ts` tendría
-- que hacer una consulta aparte después de descontar solo para saber si
-- algún producto quedó bajo el umbral.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0010.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.inventario
  add column alertado_en date;

-- Reemplaza la función de la migración 0010: mismo comportamiento de
-- validar-todo-antes-de-tocar-nada, pero ahora también informa en qué quedó
-- cada producto tras el descuento.
create or replace function public.descontar_stock_carrito(
  p_negocio_id uuid,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  faltantes text[] := '{}';
  disponible int;
  restante jsonb := '[]'::jsonb;
  nuevo_stock int;
begin
  for item in select * from jsonb_to_recordset(p_items) as x(service_id text, cantidad int)
  loop
    select stock into disponible
      from public.inventario
      where negocio_id = p_negocio_id and service_id = item.service_id
      for update;
    if found and disponible < item.cantidad then
      faltantes := array_append(faltantes, item.service_id);
    end if;
  end loop;

  if array_length(faltantes, 1) > 0 then
    return jsonb_build_object('ok', false, 'faltantes', to_jsonb(faltantes));
  end if;

  for item in select * from jsonb_to_recordset(p_items) as x(service_id text, cantidad int)
  loop
    update public.inventario
      set stock = stock - item.cantidad, updated_at = now()
      where negocio_id = p_negocio_id and service_id = item.service_id
      returning stock into nuevo_stock;
    -- `found`: solo los productos SÍ trackeados en inventario (los que no
    -- tienen fila nunca se tocan, y tampoco tiene sentido reportar un
    -- "restante" que no viene de ningún descuento real).
    if found then
      restante := restante || jsonb_build_object('service_id', item.service_id, 'stock', nuevo_stock);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'restante', restante);
end;
$$;

-- Marca la alerta de HOY para (negocio, producto) — `true` la primera vez del
-- día (corresponde avisar), `false` si ya se había marcado (no avisar de nuevo).
create or replace function public.marcar_alerta_stock_bajo(
  p_negocio_id uuid,
  p_service_id text
) returns boolean
language sql
security definer
set search_path = public
as $$
  with actualizado as (
    update public.inventario
    set alertado_en = current_date
    where negocio_id = p_negocio_id
      and service_id = p_service_id
      and (alertado_en is null or alertado_en <> current_date)
    returning 1
  )
  select exists(select 1 from actualizado);
$$;
