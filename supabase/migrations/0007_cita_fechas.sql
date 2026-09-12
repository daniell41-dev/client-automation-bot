-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0007: fecha real de la cita en `leads` (T-20).
--
-- Hasta ahora la única fecha que vive en el lead es `tentative_date`, texto
-- libre en español ("el viernes", "mañana a las 3") — imposible de comparar
-- contra `now()` por código. `scheduleConfirmedAppointment` (`handle.ts`) YA
-- resuelve esa fecha a un ISO real con `llm.extractDateTime()` para crear el
-- evento de calendario, y hasta ahora lo tiraba: no había dónde guardarlo.
--
-- `appointment_at` es esa fecha real, la que permite (a partir de T-20) validar
-- la cita contra los horarios de atención y cerrarla sola cuando ya pasó.
-- Nullable: negocios sin IA no pueden resolver texto libre a fecha exacta, y
-- una fecha ambigua ("cuando puedas") tampoco resuelve a nada — en esos casos
-- se sigue funcionando igual que hoy, sin fecha exacta.
--
-- `confirmed_at` es cuándo se confirmó la cita/pedido. NO es redundante con
-- `updated_at`: esa columna se sobreescribe en cada mensaje entrante, así que
-- no sirve para medir "hace cuánto se confirmó esto" — es lo que permite
-- cerrar solas las citas sin fecha exacta a los N días de confirmadas.
--
-- Sin backfill: la fecha vieja en `tentative_date` es texto libre no
-- parseable sin volver a llamar a la IA. Los leads ya agendados quedan con
-- ambas columnas en null.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0006.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leads
  add column appointment_at timestamptz,
  add column confirmed_at timestamptz;

create index leads_appointment_at_idx on public.leads (business_slug, appointment_at desc);
