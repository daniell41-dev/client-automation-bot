<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas del proyecto: client-automation-bot

El bloque de arriba lo gestiona `next dev` (Next.js en sí) y no se toca a mano. Lo
que sigue es específico de este repo — léelo antes de escribir código.

**Backlog y contrato de trabajo:** [`docs/14-plan-de-trabajo.md`](./docs/14-plan-de-trabajo.md).
Las decisiones de su sección 2 están cerradas (no re-discutirlas, ejecutarlas) y las
convenciones de su sección 3 son las mismas 7 reglas de abajo, en más detalle.

## 1. Una rama por tarea, un PR por tarea

`feat/T-03-rls-fix`, `fix/T-05-webhook-ack`, `docs/T-19-handoff` — nunca agrupar
varias tareas en un mismo PR. Todas las ramas salen de `develop` y vuelven a
`develop` vía PR (el único PR que no se mergea solo es `develop → main`, ver
[`01-git-flow.md`](./docs/01-git-flow.md)).

## 2. Test primero

Todo módulo nuevo o modificado en `src/core/` lleva su `.test.ts` en Vitest.
`pnpm test` tiene que pasar **antes** de abrir el PR, no después.

## 3. `src/core/` no importa `next/*` ni SDKs de terceros

Arquitectura hexagonal: el core del bot (motor de conversación, estados del lead,
cálculo de seguimientos) es agnóstico de framework y de plataforma. Si una tarea
parece exigir un import de Next o de un SDK externo dentro de `core/`, la solución
es un adaptador (ver `src/core/storage/adapters/`, `src/core/channels/`) — nunca
una excepción a esta regla. Detalle en [`02-architecture.md`](./docs/02-architecture.md).

## 4. Comentarios en español explicando el POR QUÉ, no el QUÉ

El código ya dice qué hace; el comentario vale cuando explica una decisión, un
trade-off o algo no obvio (por qué esta validación, por qué este orden, qué bug
evita). `src/core/ai/resilient.ts` es la referencia de estilo.

## 5. Toda escritura a `negocios.config` o `rubros.template` pasa por Zod

Antes de tocar la base: `businessConfigSchema` (`src/core/config-schema.ts`) valida
la forma completa. Nunca insertar/actualizar esas columnas con datos sin validar,
ni en una Server Action ni en un script (`seed-supabase.ts` también pasa por ahí).

## 6. Antes de abrir el PR

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Los cuatro en verde. En CI (`.github/workflows/ci.yml`) corren solos en cada PR,
pero no hay que esperar a que lo diga la Action: correrlos localmente primero.

## 7. Si una tarea resulta más grande de lo descrito, parar

No improvisar alcance nuevo sobre la marcha. Si al implementar aparece que la
tarea es más grande de lo que describe el plan, parar y comentarlo (en el PR o
con quien esté pidiendo el trabajo) antes de seguir escribiendo código.
