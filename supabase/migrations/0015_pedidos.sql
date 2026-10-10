-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0015: tabla `pedidos` (T-30, ADR-004 en docs/15-adr.md).
--
-- Hasta acá el lead ERA el pedido: el carrito vivía en `leads.items` y el
-- estado de la venta en `leads.stage`. Sin un pedido con identidad propia,
-- la dueña no tenía a qué número responder y el bot aprobaba el pedido
-- pendiente más viejo (FIFO) — exactamente el hueco que usa un pantallazo
-- falso. Cada venta confirmada por el cliente pasa a ser una fila acá, con
-- número corto por negocio (#1, #2, …) y su propio ciclo de vida.
--
-- `items` es una COPIA (nombre, cantidad, precio al momento de pedir): si la
-- dueña cambia un precio mañana, el pedido de hoy sigue diciendo lo que el
-- cliente aceptó pagar.
--
-- El número se asigna con un contador por negocio en una tabla aparte, y no
-- con una columna en `negocios`: esa fila la puede escribir la dueña desde
-- el portal (RLS `negocios_own`), y el contador no tiene que estar a su
-- alcance. `crear_pedido` incrementa el contador y crea el pedido en la
-- misma transacción: dos pedidos simultáneos nunca reciben el mismo número
-- (mismo criterio que `descontar_stock_carrito`, 0010).
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0014.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.pedido_contadores (
  negocio_id uuid primary key references public.negocios(id) on delete cascade,
  ultimo int not null default 0
);

alter table public.pedido_contadores enable row level security;
-- Sin políticas: solo el bot (service role) lo toca.

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  numero int not null,
  lead_id uuid references public.leads(id) on delete set null,
  contacto text not null,          -- WhatsApp del cliente (Lead.contact)
  cliente text,                    -- nombre que dio el cliente
  items jsonb not null,            -- [{serviceId, nombre, cantidad, precioUnitario}]
  total numeric(14,2) not null,
  moneda text not null,
  modalidad text,                  -- T-36: domicilio / recoger / comer acá
  direccion text,                  -- T-36: solo si es domicilio
  estado text not null
    check (estado in ('esperando_pago','por_verificar','aprobado','listo','entregado','rechazado','vencido')),
  codigo_retiro text,              -- T-37: se genera al aprobar
  comprobante_id uuid references public.comprobantes(id) on delete set null, -- T-31
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (negocio_id, numero)
);

-- `abiertoDeLead` busca por lead; el panel de pedidos (T-38) por negocio y estado.
create index pedidos_lead on public.pedidos (lead_id, created_at desc);
create index pedidos_negocio_estado on public.pedidos (negocio_id, estado, created_at desc);

alter table public.pedidos enable row level security;

-- admin ve/edita todo; la dueña LEE los de su negocio (panel, T-38). Cambiar
-- el estado desde el portal llega con T-38, con su propia política — hasta
-- entonces solo el bot (service role) escribe.
create policy pedidos_admin on public.pedidos
  for all using (public.is_admin());
create policy pedidos_own on public.pedidos
  for select using (
    negocio_id in (select id from public.negocios where owner_id = auth.uid())
  );

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
  p_estado text
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
    modalidad, direccion, estado
  ) values (
    p_negocio_id, siguiente, p_lead_id, p_contacto, p_cliente, p_items, p_total,
    p_moneda, p_modalidad, p_direccion, p_estado
  )
  returning * into creado;

  return creado;
end;
$$;

-- Una función `security definer` expuesta por la API se puede llamar con la
-- clave pública (anon) si no se restringe: cualquiera podría inventar
-- pedidos. Solo el bot (service role) la ejecuta.
revoke execute on function public.crear_pedido(uuid, uuid, text, text, jsonb, numeric, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.crear_pedido(uuid, uuid, text, text, jsonb, numeric, text, text, text, text)
  to service_role;
