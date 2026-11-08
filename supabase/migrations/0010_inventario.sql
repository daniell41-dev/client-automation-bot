-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0010: stock por producto, con descuento atómico (T-21, PR 4/5).
--
-- El stock NO vive en `negocios.config` (el JSONB del catálogo): esa columna
-- se reescribe ENTERA en cada guardado del portal, así que una venta y una
-- edición de catálogo simultáneas se pisarían el contador. Tabla propia,
-- mismo criterio que `mensajes_procesados` (0004) y `uso_ia` (0005): el
-- descuento es atómico EN LA BASE (`descontar_stock_carrito`), nunca un
-- leer-restar-escribir desde la app — dos pedidos simultáneos del mismo
-- producto no pueden pisarse el contador.
--
-- Un producto SIN fila acá (nunca se llamó `fijar_stock`) se considera SIN
-- LÍMITE: mismo criterio que `Service.stock` opcional en `core/types.ts` — un
-- rubro que no declara stock no debe empezar a bloquear pedidos por default.
-- `fijar_stock` REEMPLAZA el valor (no es un delta): es lo que el dueño
-- escribe en el editor de catálogo del portal, no un ajuste incremental.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0009.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.inventario (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  service_id text not null,
  stock int not null default 0 check (stock >= 0),
  updated_at timestamptz not null default now(),
  primary key (negocio_id, service_id)
);

alter table public.inventario enable row level security;
-- Solo el bot (service role) la toca — igual criterio que `mensajes_procesados`
-- y `uso_ia`: RLS habilitada sin políticas, nadie más lee ni escribe.

-- Fija (reemplaza) el stock de un producto. Se llama al guardar el catálogo
-- del portal — el dueño está diciendo "hoy hay N unidades", no sumando.
create or replace function public.fijar_stock(
  p_negocio_id uuid,
  p_service_id text,
  p_stock int
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.inventario (negocio_id, service_id, stock, updated_at)
  values (p_negocio_id, p_service_id, p_stock, now())
  on conflict (negocio_id, service_id) do update set
    stock = excluded.stock,
    updated_at = now();
$$;

-- Descuenta TODO un carrito de una — o nada, si algún producto no alcanza.
-- p_items: jsonb array [{"service_id": "...", "cantidad": n}, ...].
-- Devuelve {"ok": true} o {"ok": false, "faltantes": ["service_id", ...]}.
--
-- `for update` bloquea las filas involucradas por el resto de la transacción
-- de esta llamada — dos `descontar_stock_carrito` concurrentes sobre el
-- mismo producto se serializan en vez de leer el mismo valor viejo los dos.
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
begin
  for item in select * from jsonb_to_recordset(p_items) as x(service_id text, cantidad int)
  loop
    select stock into disponible
      from public.inventario
      where negocio_id = p_negocio_id and service_id = item.service_id
      for update;
    -- `not found`: el producto no está bajo control de stock — nunca bloquea.
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
      where negocio_id = p_negocio_id and service_id = item.service_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;
