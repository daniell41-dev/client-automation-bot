-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0009: carrito de un pedido en `leads` (T-21).
--
-- El flujo de pedido (item de catálogo de modo "pedido", ver
-- `core/engine/modo-item.ts`) guarda en `lead.items` qué productos y cuántas
-- unidades lleva el cliente. A diferencia de `service_id`/`tentative_date`
-- (un solo valor), un pedido admite VARIOS productos en un mismo carrito, así
-- que la columna es un array JSON: `[{ "serviceId": "...", "cantidad": 2 }, ...]`.
--
-- Sin esta columna, cada mensaje del cliente ("2 harinas", después "1 aceite")
-- perdería lo cargado en el mensaje anterior al recargar el lead desde la
-- base entre un webhook y el siguiente — a diferencia de `entrega`, que vive
-- una sola pregunta y rara vez sobrevive más de un mensaje sin confirmarse,
-- un carrito puede construirse a lo largo de varios turnos.
--
-- `jsonb` (no una tabla aparte): mismo criterio que `follow_ups_sent` — es
-- una lista chica, propia del lead, que se lee/escribe siempre entera. Nunca
-- se usa para calcular stock (eso vive en su propia tabla, ver el PR de
-- inventario) — acá es solo lo que el cliente pidió.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0008.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leads
  add column items jsonb;
