-- Resumen del día por WhatsApp a la dueña (ver core/engine/ventas-del-dia.ts).
--
-- Una fila por negocio y día local en que ya se mandó el resumen. El cron
-- corre cada 15 minutos durante 3 horas después del cierre: sin esto, la
-- dueña recibiría el mismo resumen hasta 12 veces. El INSERT con la llave
-- primaria gana o pierde la carrera (mismo criterio que
-- `mensajes_procesados`, 0004): nunca hay "leer y después escribir".
create table if not exists public.resumenes_diarios (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  fecha date not null,
  enviado_at timestamptz not null default now(),
  primary key (negocio_id, fecha)
);

-- Solo la usa el servidor (service role); nadie la lee desde el navegador.
alter table public.resumenes_diarios enable row level security;
