-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0024: cuánto se pagó de cada pedido según sus comprobantes (T-66).
--
-- En la prueba real un cliente transfirió $100 de un pedido de $400. La dueña
-- solo podía aprobar o rechazar, y al rechazar el negocio se quedaba con los
-- $100 sin que nadie llevara la cuenta. Con esta columna el bot puede pedir
-- "te faltan $300" y sumar el segundo comprobante al primero.
--
-- Es lo que DICEN los comprobantes, no plata verificada: la dueña sigue
-- revisando en su banco antes de aprobar.
--
-- Lo escribe solo el bot (service role). La dueña ya lo lee con la política
-- de lectura de `pedidos` (0015).
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0023.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pedidos
  add column if not exists monto_pagado numeric(14,2) not null default 0;
