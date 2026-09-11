-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0003: corrige dos referencias de columna sin calificar en RLS
-- (`0001_schema_inicial.sql`, políticas `rubros_asignados` y `negocios_own`).
--
-- Postgres resuelve un nombre de columna ambiguo contra la tabla MÁS INTERNA
-- que lo tenga (el scoping normal de SQL, no un bug de Postgres). En las dos
-- políticas de abajo, el nombre sin calificar coincide con una columna de
-- `asignaciones` (la subconsulta), no con la tabla protegida:
--
--   rubros_asignados — `where a.rubro_id = id`:
--     "id" resuelve a asignaciones.id, no a rubros.id → la condición queda
--     `a.rubro_id = a.id`, que nunca es verdadera → un cliente NO puede leer
--     ningún rubro que tenga asignado (RLS se lo bloquea sin querer).
--
--   negocios_own (with check) — `where a.rubro_id = rubro_id`:
--     "rubro_id" (derecha) resuelve también a asignaciones.rubro_id (la misma
--     columna de la izquierda) → la condición queda `a.rubro_id = a.rubro_id`,
--     siempre verdadera si el usuario tiene AL MENOS UNA asignación → un
--     cliente puede crear un negocio en cualquier rubro, esté o no asignado.
--
-- El arreglo es calificar con el nombre de la tabla protegida: `rubros.id` y
-- `negocios.rubro_id`. Test de regresión: `supabase/tests/rls.test.ts`
-- (`pnpm test:rls`, ver docs/06-testing-guide.md).
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de la 0001 y
-- la 0002.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy rubros_asignados on public.rubros;
create policy rubros_asignados on public.rubros
  for select using (
    exists (
      select 1 from public.asignaciones a
      where a.rubro_id = rubros.id and a.user_id = auth.uid()
    )
  );

drop policy negocios_own on public.negocios;
create policy negocios_own on public.negocios
  for all using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.asignaciones a
      where a.rubro_id = negocios.rubro_id and a.user_id = auth.uid()
    )
  );
