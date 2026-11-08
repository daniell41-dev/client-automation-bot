-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0014: llaves de Wompi por negocio (T-24.5, Nivel 2 de pagos).
--
-- Se numera 0014 porque 0011/0012/0013 ya los usan T-22.2, T-23.5 y T-24.1
-- respectivamente — aplicar esas migraciones primero si todavía no están en
-- la base.
--
-- CRÍTICO: estas tres columnas son SECRETOS y van AFUERA de `negocios.config`
-- a propósito. `config` es el JSONB que el portal lee entero y le pasa tal
-- cual al editor del dueño (`app/portal/negocios/[slug]/configuracion/page.tsx`
-- hace `select("config", ...)` con el cliente de USUARIO, no el de service
-- role) — cualquier cosa que viva ahí adentro es, en los hechos, visible en
-- el navegador. `integrity_secret`/`events_secret` firman/verifican
-- transacciones de dinero real: si se filtran, cualquiera puede armar un
-- link de pago con un monto propio o falsificar un webhook de "pago
-- aprobado". `public_key` no es secreta por diseño de Wompi, pero vive acá
-- igual por prolijidad (las tres llaves entran/salen juntas).
--
-- Ninguna política de RLS habilita su lectura — ninguna consulta del portal
-- debe pedir estas columnas (todas hacen `select("config", ...)` explícito,
-- nunca `select("*")`); solo el bot, con la service role key, las lee para
-- armar el link de pago y verificar la firma del webhook.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0013.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.negocios
  add column if not exists wompi_public_key text,
  add column if not exists wompi_integrity_secret text,
  add column if not exists wompi_events_secret text;
