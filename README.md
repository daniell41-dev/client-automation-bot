# client-automation-bot — Nexo

**SaaS multi-tenant de atención y ventas por WhatsApp para negocios pequeños.**
Cada negocio tiene su propio bot: responde al instante, captura los datos del
cliente, organiza los leads por estado y calcula el seguimiento — para que el
negocio no pierda clientes por no responder a tiempo.

> Rubro de la v1: estética/belleza. La arquitectura permite revenderlo a
> cualquier rubro (y a otras plataformas de mensajería) **sin tocar el core**.

## Qué incluye

- 💬 Bot de WhatsApp con IA (cadena de respaldo Gemini → Groq → Cerebras;
  degrada solo a plantillas de texto si no hay ninguna key configurada).
- 🏢 **Multi-tenant en Supabase**: un negocio = una fila con su propio catálogo,
  mensajes y persona — no un fork de código por cliente.
- 👤 **Portal** (`/portal`) — el dueño del negocio configura catálogo,
  tono del bot y conocimiento de la IA.
- 🛠️ **Back office** (`/backoffice`) — el admin crea rubros (plantillas
  verticales), crea negocios a partir de una plantilla y los asigna a su dueño.
- 🎭 **Demo pública** (`/demo`) — prueba el bot en un chat, sin login.
- 🗂️ Leads organizados por estado (nuevo · interesado · agendado · perdido ·
  recurrente) con cálculo de seguimientos (2h / 1 día / 3 días).
- 🧪 Simulador offline: prueba toda la conversación **sin Meta, sin tokens,
  sin red**.
- ✅ CI en cada PR (lint, tipos, tests —incluidos los de RLS contra un
  Postgres real—, build) y alarma automática si un proveedor de IA gratuito
  da de baja su modelo.

## Arranque rápido

Para probar el motor del bot sin ninguna cuenta externa:

```bash
pnpm install
pnpm sim "Hola, quiero info de limpieza facial"
```

Esto no necesita Supabase ni WhatsApp: corre contra el negocio de ejemplo
(`estetica-bella`) guardado en código.

Para levantar el portal/back office completo (multi-tenant, con Supabase):

```bash
cp .env.example .env.local   # completar NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
pnpm dev                     # http://localhost:3000
```

Ver [`docs/08-supabase-saas.md`](./docs/08-supabase-saas.md) para crear el
proyecto de Supabase, aplicar las migraciones y sembrar datos de prueba
(`pnpm seed:supabase`).

## Scripts

| Script | Qué hace |
|--------|----------|
| `pnpm dev` | Servidor de desarrollo (http://localhost:3000). |
| `pnpm build` | Build de producción. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Tests del core (Vitest). |
| `pnpm test:rls` / `pnpm test:cascade` | Tests de integración de RLS/FK contra un Postgres real (ver `docs/06-testing-guide.md`). |
| `pnpm sim "mensaje"` | Simulador offline del bot. Acepta varios mensajes y `--business <slug>`. |
| `pnpm ai:doctor` | Diagnóstico de los proveedores de IA configurados (auth, `enhance()`, `runAgent()`). |
| `pnpm seed:supabase` | Siembra rubros/negocios de prueba en Supabase. |

Ejemplo de conversación completa con el simulador:

```bash
pnpm sim "Hola" "limpieza facial" "Laura Pérez" "el viernes"
```

## Estructura

```
src/
  core/         # GENÉRICO: motor, canales, IA, almacenamiento — no importa next/* ni SDKs
  businesses/   # Negocio de ejemplo + resolución de negocio (código o Supabase)
  app/
    portal/       # Cliente: catálogo, configuración del bot
    backoffice/   # Admin: rubros, negocios, usuarios, asignaciones
    demo/         # Demo pública del bot
    api/          # Webhook de WhatsApp + endpoint de simulación
supabase/       # Migraciones SQL (schema + RLS) y tests de integración
scripts/        # CLI: simulador, ai:doctor, seed, doctors de Sheets/Calendar
docs/           # Documentación — ver docs/00-overview.md para el índice completo
```

Los dos ejes de personalización (sin tocar `core/`):

- **Rubro** → plantilla en Supabase (`rubros.template`) o, para el negocio de
  ejemplo, `src/businesses/<slug>/config.ts`.
- **Plataforma** → `src/core/channels/<plataforma>/` (WhatsApp hoy).

## WhatsApp

Las respuestas reales por WhatsApp requieren credenciales de Meta:

```bash
cp .env.example .env.local   # y completar las variables de WHATSAPP_*
```

Ver [`docs/05-whatsapp-setup.md`](./docs/05-whatsapp-setup.md).

## Documentación

| Documento | Para qué |
|-----------|----------|
| [`docs/00-overview.md`](./docs/00-overview.md) | Visión general del proyecto |
| [`docs/01-git-flow.md`](./docs/01-git-flow.md) | Flujo de Git/GitHub, PR template, CI |
| [`docs/02-architecture.md`](./docs/02-architecture.md) | Cómo está construido por dentro |
| [`docs/03-team-guide.md`](./docs/03-team-guide.md) | Cómo trabajar en el repo |
| [`docs/04-add-new-business.md`](./docs/04-add-new-business.md) | Agregar un negocio nuevo |
| [`docs/05-whatsapp-setup.md`](./docs/05-whatsapp-setup.md) | Conectar WhatsApp Cloud API |
| [`docs/06-testing-guide.md`](./docs/06-testing-guide.md) | Probar el bot con el simulador y los tests de integración |
| [`docs/07-google-sheets.md`](./docs/07-google-sheets.md) | Persistencia en Google Sheets por negocio |
| [`docs/08-supabase-saas.md`](./docs/08-supabase-saas.md) | Supabase, portal, back office y deploy gratis en Vercel |
| [`docs/design/README.md`](./docs/design/README.md) | Handoff de diseño "Nexo": pantallas, tokens y mapeo a Supabase |
| [`docs/10-notificaciones-y-pedidos.md`](./docs/10-notificaciones-y-pedidos.md) | Notificación WhatsApp a la dueña + modalidad de pedido |
| [`docs/11-proveedor-ia.md`](./docs/11-proveedor-ia.md) | IA gratis y estable (cadena de respaldo Gemini → Groq → Cerebras) |
| [`docs/12-comprension-del-cliente.md`](./docs/12-comprension-del-cliente.md) | Español de chat + intérprete IA |
| [`docs/13-modo-agente.md`](./docs/13-modo-agente.md) | Modo agente: la IA decide acciones validadas, no solo reformula texto |
| [`docs/14-plan-de-trabajo.md`](./docs/14-plan-de-trabajo.md) | Contrato de trabajo: decisiones cerradas, convenciones y backlog |

Ver también [`AGENTS.md`](./AGENTS.md) (o `CLAUDE.md`, que lo referencia) para
las convenciones que sigue todo cambio en este repo.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth + RLS) · Vitest · **pnpm**.

> Usa siempre `pnpm` (nunca npm/yarn): el lockfile es `pnpm-lock.yaml`.

## Fuera de alcance (v1)

Recordatorios y postventa automáticos vía cron, agenda con reserva en vivo,
reporte semanal, adaptador de Instagram, campos de catálogo dinámicos por
rubro (aplazado hasta el segundo negocio de un rubro distinto) y planes
Free/Pro con límites — ver el detalle y los disparadores en
[`docs/14-plan-de-trabajo.md`](./docs/14-plan-de-trabajo.md).
