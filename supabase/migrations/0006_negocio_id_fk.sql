-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0006: `negocio_id` como FK en `leads` y `sesiones` (T-08).
--
-- Hoy se enlazan por `business_slug` (texto): si el slug cambiara quedarían
-- huérfanos, y si se borra el negocio, sus leads/sesiones quedan colgados
-- para siempre (nadie los borra). `negocio_id` no reemplaza a `business_slug`
-- — el motor y las políticas de RLS (`owns_negocio`, `leads_own`) lo siguen
-- usando tal cual — es una FK de conveniencia que hace explícita la relación
-- e integra el borrado en cascada.
--
-- Nullable a propósito: negocios que viven SOLO en el registry estático de
-- código (sin fila en `negocios`, ver `src/businesses/registry.ts`) no tienen
-- un `id` real que referenciar — sus leads/sesiones quedan con
-- `negocio_id = null`, igual que hoy. El motor sigue funcionando igual: la
-- app siempre escribe/lee por `business_slug`, nunca por `negocio_id`.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0005.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leads
  add column negocio_id uuid references public.negocios(id) on delete cascade;

alter table public.sesiones
  add column negocio_id uuid references public.negocios(id) on delete cascade;

-- Backfill: los leads/sesiones que ya existen se enlazan por el slug que
-- tienen hoy. Los que no matcheen ningún negocio (huérfanos reales, o de un
-- negocio que solo vive en el registry estático) quedan con negocio_id null.
update public.leads l
set negocio_id = n.id
from public.negocios n
where n.slug = l.business_slug and l.negocio_id is null;

update public.sesiones s
set negocio_id = n.id
from public.negocios n
where n.slug = s.business_slug and s.negocio_id is null;

create index leads_negocio_id_idx on public.leads (negocio_id);
create index sesiones_negocio_id_idx on public.sesiones (negocio_id);
