-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0016: devolver el stock de un pedido que no se concretó (T-32).
--
-- El stock se descuenta cuando el cliente confirma el carrito (antes del
-- comprobante, para no venderle a dos personas la última unidad). Hasta acá,
-- si la dueña rechazaba el pedido o el cliente nunca pagaba, esas unidades
-- quedaban descontadas para siempre y el producto figuraba agotado sin
-- estarlo.
--
-- `stock_reservado` dice si ESTE pedido descontó stock. Hace falta porque no
-- todos lo hacen: con Wompi el descuento recién ocurre cuando la pasarela
-- confirma el pago, así que rechazar un pedido de Wompi pendiente no tiene
-- nada que devolver. Sin la marca, se devolverían unidades que nunca se
-- sacaron.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0015.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pedidos
  add column stock_reservado boolean not null default false;

-- `crear_pedido` gana el parámetro de la marca. Se reemplaza la firma vieja
-- (un `create or replace` con otra lista de parámetros crearía una segunda
-- función en paralelo).
drop function public.crear_pedido(uuid, uuid, text, text, jsonb, numeric, text, text, text, text);

create or replace function public.crear_pedido(
  p_negocio_id uuid,
  p_lead_id uuid,
  p_contacto text,
  p_cliente text,
  p_items jsonb,
  p_total numeric,
  p_moneda text,
  p_modalidad text,
  p_direccion text,
  p_estado text,
  p_stock_reservado boolean
) returns public.pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  siguiente int;
  creado public.pedidos;
begin
  insert into public.pedido_contadores as c (negocio_id, ultimo)
  values (p_negocio_id, 1)
  on conflict (negocio_id) do update set ultimo = c.ultimo + 1
  returning ultimo into siguiente;

  insert into public.pedidos (
    negocio_id, numero, lead_id, contacto, cliente, items, total, moneda,
    modalidad, direccion, estado, stock_reservado
  ) values (
    p_negocio_id, siguiente, p_lead_id, p_contacto, p_cliente, p_items, p_total,
    p_moneda, p_modalidad, p_direccion, p_estado, p_stock_reservado
  )
  returning * into creado;

  return creado;
end;
$$;

revoke execute on function public.crear_pedido(uuid, uuid, text, text, jsonb, numeric, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.crear_pedido(uuid, uuid, text, text, jsonb, numeric, text, text, text, text, boolean)
  to service_role;

-- Devuelve las unidades de un carrito. Solo toca productos que tienen fila en
-- `inventario`: uno sin fila no está bajo control de stock (mismo criterio que
-- `descontar_stock_carrito`, 0010), y crearle una fila acá lo pasaría a
-- "limitado" sin que la dueña lo haya decidido.
-- p_items: jsonb array [{"service_id": "...", "cantidad": n}, ...].
create or replace function public.devolver_stock_carrito(
  p_negocio_id uuid,
  p_items jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  for item in select * from jsonb_to_recordset(p_items) as x(service_id text, cantidad int)
  loop
    update public.inventario
      set stock = stock + item.cantidad, updated_at = now()
      where negocio_id = p_negocio_id and service_id = item.service_id;
  end loop;
end;
$$;

revoke execute on function public.devolver_stock_carrito(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.devolver_stock_carrito(uuid, jsonb)
  to service_role;
