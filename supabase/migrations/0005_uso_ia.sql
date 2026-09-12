-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0005: medición de consumo de IA por negocio (T-07).
--
-- Sin esto no hay forma de saber cuándo un negocio se acerca al límite del
-- free tier de un proveedor (Gemini/Groq/Cerebras) ni cuándo conviene
-- pasarlo a un plan pago — ver docs/14-plan-de-trabajo.md, sección 6.
--
-- Una fila por (negocio, día, proveedor); se acumula con `registrar_uso_ia`
-- en vez de leer-sumar-escribir desde la app, por la misma razón que
-- `claimMessage` en 0004: dos llamadas concurrentes del mismo negocio no
-- pueden pisarse el contador si el incremento es atómico en la base.
--
-- `tokens_in`/`tokens_out` quedan en el schema tal como los describe el plan,
-- pero por ahora `ResilientProvider` (src/core/ai/resilient.ts) no cuenta con
-- el conteo real de tokens de cada respuesta — ver el PR de T-07 para el
-- detalle. Se registran en 0 hasta que se sume esa métrica.
--
-- Solo el bot (service role) escribe/lee esta tabla — igual criterio que
-- `mensajes_procesados`: RLS habilitada sin políticas, nadie más accede.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0004.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.uso_ia (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  dia date not null default current_date,
  proveedor text not null,
  llamadas int not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  fallbacks int not null default 0, -- veces que cayó a plantilla/motor determinista
  primary key (negocio_id, dia, proveedor)
);

alter table public.uso_ia enable row level security;

-- Incrementa (o crea) la fila del día para (negocio_id, proveedor). Todos los
-- contadores son deltas a SUMAR sobre el valor existente, no el total nuevo.
create or replace function public.registrar_uso_ia(
  p_negocio_id uuid,
  p_proveedor text,
  p_llamadas int default 0,
  p_tokens_in bigint default 0,
  p_tokens_out bigint default 0,
  p_fallbacks int default 0
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.uso_ia (negocio_id, dia, proveedor, llamadas, tokens_in, tokens_out, fallbacks)
  values (p_negocio_id, current_date, p_proveedor, p_llamadas, p_tokens_in, p_tokens_out, p_fallbacks)
  on conflict (negocio_id, dia, proveedor) do update set
    llamadas = public.uso_ia.llamadas + excluded.llamadas,
    tokens_in = public.uso_ia.tokens_in + excluded.tokens_in,
    tokens_out = public.uso_ia.tokens_out + excluded.tokens_out,
    fallbacks = public.uso_ia.fallbacks + excluded.fallbacks;
$$;
