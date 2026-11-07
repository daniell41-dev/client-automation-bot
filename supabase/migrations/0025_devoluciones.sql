-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0025: devoluciones de pedidos rechazados (T-67).
--
-- Cuando la dueña rechaza un pedido que tenía comprobante, el bot le pide al
-- cliente a qué cuenta devolverle y el panel le muestra a la dueña "Devolver
-- $X" con esa cuenta hasta que ella marque "Ya devolví". El monto es
-- `monto_pagado` (0024): lo que dicen los comprobantes del pedido.
--
--   devolucion_estado: null (no hay nada que devolver), 'pidiendo_cuenta',
--                      'pendiente' (ya hay cuenta) o 'devuelta'.
--   devolucion_cuenta: lo que escribió el cliente, tal cual.
--   devuelta_at:       cuándo marcó la dueña que devolvió.
--
-- Lo escribe el bot (service role): el panel marca "Ya devolví" con una
-- Server Action que primero comprueba que la dueña puede leer el pedido.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0024.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pedidos
  add column if not exists devolucion_estado text
    check (devolucion_estado in ('pidiendo_cuenta', 'pendiente', 'devuelta')),
  add column if not exists devolucion_cuenta text,
  add column if not exists devuelta_at timestamptz;

-- El panel busca las devoluciones abiertas de cada negocio.
create index if not exists pedidos_devoluciones
  on public.pedidos (negocio_id, devolucion_estado)
  where devolucion_estado in ('pidiendo_cuenta', 'pendiente');
