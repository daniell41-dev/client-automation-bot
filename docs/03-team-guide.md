# 03 - Guía de equipo

Cómo trabajar en este repositorio sin romper nada y manteniendo el código fácil de
mantener y de revender a otros negocios.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (para el panel `/admin`)
- **Vitest** para tests del core
- **pnpm** como gestor de paquetes (¡siempre!)

## Regla de oro: usa siempre `pnpm`

El lockfile del repo es `pnpm-lock.yaml`. **Nunca** uses `npm` ni `yarn`: rompen el
lockfile y generan diffs ruidosos.

## Scripts

```bash
pnpm install        # instalar dependencias
pnpm dev            # servidor de desarrollo (http://localhost:3000)
pnpm build          # build de producción
pnpm lint           # ESLint
pnpm test           # tests del core (Vitest)
pnpm sim "mensaje"  # simulador offline: pasa un mensaje por el motor y muestra la salida
```

> `pnpm test` y `pnpm sim` se configuran en la feature del core. Si aún no existen,
> es porque esa feature todavía no se mergeó.

## Antes de hacer push

1. `pnpm lint` sin errores.
2. `pnpm build` exitoso.
3. `pnpm test` en verde (si tocaste el core).
4. Probaste el cambio (con `pnpm sim` o `pnpm dev`).

## Dónde va cada cosa

```
src/
  core/         ← LÓGICA GENÉRICA. No depende de ningún negocio ni de Next/Meta.
                  Si tu cambio sirve para CUALQUIER cliente, va aquí.
  businesses/   ← CONFIGURACIÓN POR NEGOCIO. Solo datos (servicios, precios, mensajes).
                  Si tu cambio es específico de UN cliente, va aquí (no en core).
  app/          ← Capa Next.js: rutas, webhook, panel. Traduce HTTP ↔ motor.
docs/           ← Esta documentación.
scripts/        ← Utilidades de línea de comandos (p. ej. el simulador).
```

### El principio que NO se rompe

`core/` **no importa** nada de Next.js (`next/*`) ni del SDK de Meta. El motor solo
conoce tipos normalizados (`IncomingMessage`, `OutgoingMessage`, `Lead`…). Los
adaptadores son los únicos que traducen a cada plataforma o almacenamiento.

¿Por qué? Para que el mismo motor sirva en WhatsApp, Instagram, en tests o en el
simulador, sin cambios. Y para poder testearlo sin levantar un servidor.

## Estilo de código

- **TypeScript estricto.** Evita `any`; prefiere tipos del `core/types.ts`.
- **Nombres descriptivos.** Archivos en `kebab-case` (`lead-state.ts`).
- **Sin `console.log` de debug** en el código que se mergea.
- **Funciones puras en el motor.** El motor decide; los efectos (enviar, guardar) viven
  en los adaptadores. Eso mantiene el core testeable.
- **DRY / KISS.** Prefiere lo simple. Este es un MVP.

## Commits y ramas

Seguimos **Conventional Commits** y un flujo `develop + feature/* + PR`. Está todo
detallado en [`01-git-flow.md`](./01-git-flow.md).

## Agregar un negocio nuevo

No toques `core/`. Copia la plantilla y registra el slug. Paso a paso en
[`04-add-new-business.md`](./04-add-new-business.md).
