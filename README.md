# client-automation-bot

**Mini-fábrica de atención y ventas para negocios pequeños.** Un bot que recibe
interesados por WhatsApp, les responde al instante, captura sus datos, los organiza
por estado y calcula el seguimiento — para que el negocio no pierda clientes por no
responder a tiempo.

> Rubro demo: estética/belleza. La arquitectura permite revenderlo a cualquier rubro
> (y a otras plataformas como Instagram) **sin tocar el core**.

## Características (MVP)

- 💬 Respuesta automática por WhatsApp con menú de servicios.
- 📝 Captura de datos del cliente (nombre, servicio, fecha tentativa).
- 🗂️ Leads organizados por estado: nuevo · interesado · agendado · pagado · perdido · recurrente.
- ⏰ Cálculo de seguimientos (2h / 1 día / 3 días) — "la parte más valiosa".
- 🖥️ Panel `/admin` de solo lectura para ver los leads.
- 🧪 Simulador offline: prueba toda la conversación **sin Meta, sin tokens, sin red**.

## Arranque rápido

```bash
pnpm install
pnpm sim "Hola, quiero info de limpieza facial"   # probar el bot offline
```

Para levantar la app web (panel + webhook):

```bash
pnpm dev        # http://localhost:3000  (panel en /admin)
```

## Scripts

| Script | Qué hace |
|--------|----------|
| `pnpm dev` | Servidor de desarrollo (http://localhost:3000). |
| `pnpm build` | Build de producción. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Tests del core (Vitest). |
| `pnpm sim "mensaje"` | Simulador offline del bot. Acepta varios mensajes y `--business <slug>`. |

Ejemplo de conversación completa con el simulador:

```bash
pnpm sim "Hola" "limpieza facial" "Laura Pérez" "el viernes"
```

## Estructura

```
src/
  core/         # GENÉRICO: motor, canales, almacenamiento (no toca por cliente/plataforma)
  businesses/   # PERSONALIZACIÓN por rubro: un archivo de config por negocio
  app/          # Capa Next.js: webhook, ruta de simulación, panel /admin
scripts/        # Simulador CLI (pnpm sim)
docs/           # Documentación (overview, git flow, arquitectura, onboarding, WhatsApp)
```

Los dos ejes de personalización (sin tocar `core/`):

- **Rubro** → `src/businesses/<slug>/config.ts` (servicios, precios, mensajes).
- **Plataforma** → `src/core/channels/<plataforma>/` (WhatsApp hoy; Instagram mañana).

## WhatsApp

Las respuestas reales por WhatsApp requieren credenciales de Meta. Copia las variables
y síguelas en la guía:

```bash
cp .env.example .env.local   # y rellena las 4 variables de WhatsApp
```

Ver [`docs/05-whatsapp-setup.md`](./docs/05-whatsapp-setup.md).

## Documentación

- [`docs/00-overview.md`](./docs/00-overview.md) — visión general.
- [`docs/01-git-flow.md`](./docs/01-git-flow.md) — flujo de trabajo Git/GitHub.
- [`docs/02-architecture.md`](./docs/02-architecture.md) — cómo está construido.
- [`docs/03-team-guide.md`](./docs/03-team-guide.md) — guía de equipo.
- [`docs/04-add-new-business.md`](./docs/04-add-new-business.md) — agregar un negocio.
- [`docs/05-whatsapp-setup.md`](./docs/05-whatsapp-setup.md) — conectar WhatsApp.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Vitest · **pnpm**.

> Usa siempre `pnpm` (nunca npm/yarn): el lockfile es `pnpm-lock.yaml`.

## Fuera de alcance (fase 2)

Recordatorios y postventa automáticos (cron + plantillas aprobadas de Meta), agenda con
reserva en vivo, reporte semanal, adaptador de Instagram, almacenamiento en Google
Sheets/Airtable y despliegue en producción.
