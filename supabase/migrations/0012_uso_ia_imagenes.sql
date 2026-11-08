-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0012: contador de imágenes procesadas por `describeImage` en
-- `uso_ia` (T-23.5).
--
-- Se numera 0012 y no 0011 porque ese número ya lo usa
-- `0011_alerta_stock_bajo.sql` (T-22.2) — aplicar esa migración primero si
-- todavía no está en la base.
--
-- Separado de `llamadas`: una llamada a `describeImage` YA cuenta como
-- `llamadas` (es una llamada real al proveedor), pero además se marca cuántas
-- de esas llamadas fueron de imagen — el costo de un modelo con visión es
-- distinto al de uno de solo texto, y esto es lo que permite cobrar el
-- excedente de imágenes aparte del de mensajes.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0011.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.uso_ia add column if not exists imagenes int not null default 0;

create or replace function public.registrar_uso_ia(
  p_negocio_id uuid,
  p_proveedor text,
  p_llamadas int default 0,
  p_tokens_in bigint default 0,
  p_tokens_out bigint default 0,
  p_fallbacks int default 0,
  p_imagenes int default 0
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.uso_ia (negocio_id, dia, proveedor, llamadas, tokens_in, tokens_out, fallbacks, imagenes)
  values (p_negocio_id, current_date, p_proveedor, p_llamadas, p_tokens_in, p_tokens_out, p_fallbacks, p_imagenes)
  on conflict (negocio_id, dia, proveedor) do update set
    llamadas = public.uso_ia.llamadas + excluded.llamadas,
    tokens_in = public.uso_ia.tokens_in + excluded.tokens_in,
    tokens_out = public.uso_ia.tokens_out + excluded.tokens_out,
    fallbacks = public.uso_ia.fallbacks + excluded.fallbacks,
    imagenes = public.uso_ia.imagenes + excluded.imagenes;
$$;
