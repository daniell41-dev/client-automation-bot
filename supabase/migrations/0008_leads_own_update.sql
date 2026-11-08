-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0008: el dueño de un negocio puede actualizar SUS leads (T-20).
--
-- `leads_own` (0001) es `for select` únicamente: el portal puede LEER sus
-- leads, pero no tiene forma de escribirlos — hoy ninguna Server Action toca
-- la tabla `leads`. Esto habilita `marcarAtendido` (app/portal/actions.ts):
-- cerrar manualmente una cita ya cumplida, desde el portal, sin depender del
-- cierre automático (`appointment-lifecycle.ts`) ni de esperar a que el
-- cliente vuelva a escribir.
--
-- Mismo patrón que `negocios_own` (0001/0003): `using` autoriza a leer/tocar
-- la fila ANTES del cambio, `with check` valida la fila DESPUÉS — acá los dos
-- son `owns_negocio(business_slug)`, así que un dueño no puede mover un lead
-- a un negocio ajeno (no que tenga sentido hacerlo, pero por las dudas).
--
-- El bot (webhook) sigue escribiendo con la SERVICE ROLE key, que bypassa
-- RLS — esta política es solo para el camino del portal (`createUserClient`).
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0007.
-- ═══════════════════════════════════════════════════════════════════════════

create policy leads_own_update on public.leads
  for update using (public.owns_negocio(business_slug))
  with check (public.owns_negocio(business_slug));
