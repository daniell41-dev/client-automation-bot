-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0013: tabla `comprobantes` para el Nivel 1 de confirmación de
-- pago (T-24.1, `docs/15-plan-vision-tienda.md` §1.6/§4).
--
-- Se numera 0013 y no 0012 (como dice el texto del plan) porque ese número ya
-- lo usa `0012_uso_ia_imagenes.sql` (T-23.5) — aplicar esa migración primero
-- si todavía no está en la base, y `0011_alerta_stock_bajo.sql` (T-22.2)
-- antes que esa.
--
-- El corazón antifraude de todo el módulo: una `referencia` no se puede
-- repetir en el mismo negocio. Es la señal más fuerte que existe SIN acceso
-- al banco (§1.7) — un comprobante fraudulento reciclado (mismo número de
-- referencia que uno real) queda bloqueado por la base, no por una
-- comparación desde la app que un caso concurrente podría esquivar.
--
-- Guardar un comprobante acá NUNCA significa que el pago sea real (§1.6): es
-- la digitación/triaje que la dueña usa para decidir. La columna `estado`
-- arranca en 'pendiente' — solo pasa a 'aprobado' cuando la dueña dice que sí
-- (T-24.4), nunca automáticamente a partir de la imagen.
--
-- A diferencia de `inventario`/`uso_ia` (RLS sin políticas, solo el bot
-- accede), acá el dueño SÍ puede leer los suyos desde el portal — necesita
-- ver el historial de comprobantes de su negocio.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0012.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  referencia text,              -- normalizada: sin espacios, mayúsculas
  monto numeric(14,2),
  moneda text,                  -- "COP" | "VES"
  banco text,                   -- "nequi" | "bancolombia" | "mercantil" | ...
  fecha_comprobante timestamptz,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobado','rechazado')),
  señales jsonb,                -- resultado de T-24.3
  created_at timestamptz not null default now()
);

-- El corazón del antifraude: una referencia no se puede repetir en un negocio.
-- `where referencia is not null` porque un comprobante ilegible (T-24.2,
-- `legible: "ilegible"`) puede no traer referencia — eso no debe bloquear
-- que se guarden varios comprobantes sin referencia del mismo negocio.
create unique index comprobantes_ref_unica
  on public.comprobantes (negocio_id, referencia)
  where referencia is not null;

alter table public.comprobantes enable row level security;

-- admin ve/edita todo; el dueño solo LEE los de su propio negocio (portal);
-- solo el bot (service role) inserta/actualiza — mismo criterio que
-- `leads_admin`/`leads_own` (0001), pero por `negocio_id` (uuid) en vez de
-- `business_slug`, porque acá no hay motor determinista que dependa del slug.
create policy comprobantes_admin on public.comprobantes
  for all using (public.is_admin());
create policy comprobantes_own on public.comprobantes
  for select using (
    negocio_id in (select id from public.negocios where owner_id = auth.uid())
  );
