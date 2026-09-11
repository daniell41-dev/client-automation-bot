# Guía de testing para desarrolladores

Esta guía explica cómo probar el bot localmente usando el simulador CLI (`pnpm sim`), los tests automatizados y la suite de calidad de código.

---

## Prerequisitos

| Requisito | Versión mínima |
|-----------|---------------|
| Node.js | 18 |
| pnpm | 9 |

```bash
pnpm install
```

### Variable de entorno (opcional)

Crea un archivo `.env.local` en la raíz del proyecto para activar la IA (recomendado: Gemini, gratis y sin tarjeta — ver `docs/11-proveedor-ia.md`):

```
GEMINI_API_KEY=AI...
```

- **Sin ninguna key de IA:** el bot responde con las plantillas de texto definidas en el `config.ts` del negocio. El flujo de conversación es idéntico.
- **Con una key configurada:** las respuestas pasan por la IA. La IA reformula el texto con el tono de la persona configurada (p. ej. Isabella para Estética Bella en WhatsApp), pero no cambia el estado interno ni el orden de las preguntas. Se puede configurar más de una (Gemini, Groq, Cerebras) como cadena de respaldo — ver `docs/11-proveedor-ia.md`.

> **Importante:** nunca commitees `.env.local` ni la carpeta `data/` (ambas están en `.gitignore`).

---

## El simulador (`pnpm sim`)

El simulador pasa mensajes por el **mismo motor** que usa el webhook de producción, sin red ni tokens de plataforma. Hay dos modos.

### Modo A — REPL interactivo

Se activa cuando no se pasan mensajes como argumento:

```bash
pnpm sim
pnpm sim --business estetica-bella
```

- El estado (lead + historial de sesión) vive **en memoria**: se pierde al salir del proceso.
- Útil para explorar el flujo sin dejar estado residual.

**Comandos internos del REPL:**

| Comando | Qué hace |
|---------|----------|
| `/lead` | Muestra el estado actual del lead (nombre, servicio, fecha, estado, etapa) |
| `/reset` | Reinicia la conversación (nuevo lead + sesión vacía), sin salir del REPL |
| `/salir` o `/exit` | Cierra el simulador |

### Modo B — Comandos persistentes

Se activa cuando se pasa al menos un mensaje como argumento:

```bash
pnpm sim "Hola"
pnpm sim "el viernes"    # continúa desde donde quedó la última vez
pnpm sim --reset "Hola"  # limpia el estado anterior y empieza de cero
pnpm sim --reset         # solo limpia, sin enviar mensaje
```

- El estado se guarda en `data/sim/leads.json` y `data/sim/sessions/`.
- Cada invocación del proceso lee el estado guardado, procesa los mensajes y muestra el resumen final del lead.
- Puedes pasar **varios mensajes en una sola invocación**:

```bash
pnpm sim --reset "limpieza facial" "Carlos Valero" "el viernes"
```

### Flags

| Flag | Alias | Descripción |
|------|-------|-------------|
| `--business <slug>` | `-b` | Negocio a simular. Default: `estetica-bella`. Slugs registrados: `estetica-bella`. |
| `--reset` | `-r` | Borra `data/sim/` antes de procesar. Si no se pasan mensajes, solo limpia y sale. |

---

## Happy paths

### 1. Flujo completo sin IA (motor puro)

El camino más directo desde el primer contacto hasta la cita agendada:

```bash
pnpm sim --reset "Hola"
# Bot: menú de bienvenida con opciones

pnpm sim "limpieza facial"
# Bot: info del servicio + pide nombre

pnpm sim "Carlos Valero"
# Bot: pide fecha

pnpm sim "el viernes"
# Bot: pregunta de confirmación + opciones [Sí, confirmar · Cambiar fecha]

pnpm sim "sí"
# Bot: mensaje de cita agendada
# Lead: Estado: agendado · Etapa: datos_completos
```

### 2. Flujo completo con IA

Igual que el anterior, pero con `GEMINI_API_KEY` (u otra) en `.env.local`. El simulador imprime al inicio:

```
✨ IA habilitada (gemini-3.5-flash-lite) · Persona: Isabella
```

Las respuestas del bot suenan más naturales, pero el estado interno es el mismo.

### 3. Selección por número de menú

El cliente puede elegir el servicio escribiendo el número del menú en lugar del nombre:

```bash
pnpm sim --reset "1"   # Limpieza facial
pnpm sim --reset "2"   # Uñas
pnpm sim --reset "3"   # Pestañas
pnpm sim --reset "4"   # Depilación
```

### 4. Declinar fecha y volver a agendar

Cuando el cliente quiere cambiar la fecha en el paso de confirmación:

```bash
pnpm sim --reset "Hola"
pnpm sim "1"
pnpm sim "Ana"
pnpm sim "mañana"
# Bot: ¿Te confirmo tu cita de Limpieza facial para mañana, Ana? [Sí, confirmar · Cambiar fecha]

pnpm sim "cambiar fecha"
# Bot: vuelve a pedir la fecha (estado sigue siendo interesado)

pnpm sim "el sábado"
# Bot: pregunta de confirmación con la nueva fecha

pnpm sim "confirmo"
# Lead: Estado: agendado
```

### 5. REPL interactivo — sesión completa

```bash
pnpm sim
# → abre el REPL

# Escribe en el prompt:
Hola
# Bot: menú

limpieza facial
# Bot: info + pide nombre

/lead
# muestra el lead en curso

Laura
el jueves
sí
# Bot: cita agendada

/lead
# Estado: agendado · Etapa: datos_completos

/salir
```

---

## Errores comunes

| Situación | Síntoma | Solución |
|-----------|---------|----------|
| Estado anterior inconsistente | El bot responde desde un `stage` inesperado (p. ej. pide confirmación sin haber pedido nombre) | `pnpm sim --reset "Hola"` |
| Slug de negocio incorrecto | `❌ Negocio "foo" no encontrado. Disponibles: estetica-bella` | Usar un slug registrado en `src/businesses/registry.ts` |
| Sin ninguna key de IA | Inicio muestra `ℹ️  IA desactivada (sin GEMINI_API_KEY/GROQ_API_KEY/…) — usando plantillas.` | Normal; el flujo funciona igual. Para habilitar IA, añadir una key en `.env.local` (ver `docs/11-proveedor-ia.md`) |
| Key inválida o cuota agotada | `pnpm ai:doctor` muestra el error exacto | Si hay más de un proveedor configurado, la cadena de respaldo prueba el siguiente automáticamente; si no, el motor devuelve el borrador de plantilla sin reformulación IA |
| `data/sim/` con JSON corrupto | Error de parse al arrancar el modo persistente | `rm -rf data/sim/` o `pnpm sim --reset` |

---

## Tests automatizados

```bash
pnpm test              # ejecuta toda la suite (Vitest)
pnpm test --watch      # modo watch, ideal durante desarrollo
pnpm exec tsc --noEmit # verificación de tipos TypeScript
pnpm lint              # linting (ESLint)
```

### Archivos de test relevantes

| Archivo | Qué prueba |
|---------|------------|
| `src/core/engine/responder.test.ts` | Flujo completo del motor: inicio → confirmación → `agendado`; caso de decline de fecha |
| `src/core/engine/intake.test.ts` | `isGreeting`, `matchService` (por nombre, keyword y número), `isAffirmative` |
| `src/core/engine/followups.test.ts` | Cálculo de follow-ups: qué leads los necesitan y cuáles ya están fuera del embudo |
| `src/core/handle.test.ts` | Orquestador end-to-end (`handleIncoming`) sin I/O real |

### Añadir un negocio nuevo y que los tests pasen

Cuando se crea un config de negocio inline en un test, el campo `askConfirm` es **obligatorio** en `MessageTemplates`. Sin él TypeScript falla en `tsc --noEmit`. Ejemplo mínimo:

```typescript
const config = {
  // ...
  messages: {
    welcome: "...", askName: "...", askDate: "...",
    askConfirm: "¿Confirmo tu cita de {{servicio}} para {{fecha}}?",  // ← obligatorio
    serviceInfo: "...", captured: "...", fallback: "...",
  },
  // ...
};
```

---

## Estados y etapas del lead

El simulador imprime el estado del lead al final de cada invocación en modo B, o al escribir `/lead` en el REPL. Esta es la referencia rápida:

### `state` (estado comercial)

| Valor | Significado |
|-------|-------------|
| `nuevo` | Primer contacto, aún no mostró interés explícito |
| `interesado` | Eligió un servicio |
| `agendado` | Confirmó la cita |
| `pagado` | Realizó el pago (fuera de alcance del MVP) |
| `recurrente` | Cliente recurrente |
| `perdido` | No respondió o canceló |

### `stage` (etapa de conversación)

| Valor | Significado |
|-------|-------------|
| `inicio` | Aún no se le ha mostrado el menú |
| `menu_enviado` | Se mostró el menú; esperando que elija servicio |
| `info_enviada` | Se dio info del servicio |
| `esperando_nombre` | Se le pidió el nombre |
| `esperando_fecha` | Se le pidió la fecha tentativa |
| `esperando_confirmacion` | Se le preguntó si confirma la cita |
| `datos_completos` | Nombre + servicio + fecha capturados y cita agendada |

### `Próxima acción`

Calculada por `nextAction(lead.state)` en `src/core/engine/lead-state.ts`. Indica al equipo de ventas qué hacer con ese lead fuera del bot (llamar, enviar link de pago, etc.).

---

## Probar las políticas de RLS (`pnpm test:rls`)

Las políticas de Row Level Security de `supabase/migrations/` (quién puede leer/
escribir qué fila) son código, y como todo código pueden tener bugs sutiles —
`0003_fix_rls.sql` corrige dos que un cliente no podía detectar leyendo el SQL,
solo ejecutándolo. `pnpm test:rls` (`supabase/tests/rls.test.ts`) corre las
migraciones REALES contra un Postgres corriente y simula dos clientes distintos
para probarlo de verdad.

**No corre por defecto.** `pnpm test` lo salta si no hay `TEST_DATABASE_URL`
configurada — así el resto de la suite sigue verde en cualquier máquina sin
Postgres instalado.

### Levantar una base desechable

Necesitás un Postgres al que puedas conectarte por `postgresql://` — **nunca uses
tu proyecto de Supabase real**: el test borra y recrea los schemas `public`/`auth`
en cada corrida.

**Con Postgres instalado localmente** (Linux, rol `postgres`):
```bash
sudo -u postgres createdb rls_test
# TCP con contraseña (el driver `pg` no usa auth "peer" de sockets Unix):
sudo -u postgres psql -c "alter user postgres with password 'postgres';"
echo 'TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rls_test' >> .env.local
```
(macOS con Postgres.app/Homebrew: el rol suele coincidir con tu usuario del
sistema — cambiá `postgres:postgres` por `$(whoami)` sin contraseña, o creá una
con `createuser -P`.)

**Con Docker** (no necesita Postgres instalado):
```bash
docker run -d --name rls-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
echo 'TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres' >> .env.local
```

### Correr el test

```bash
pnpm test:rls
```

Siembra dos clientes de prueba (A y B), cada uno con un rubro asignado, y verifica:
1. A lee el rubro que tiene asignado.
2. A **no** ve el rubro asignado solo a B.
3. A **no** puede crear un negocio en el rubro de B (el bug de seguridad que corrige `0003`).
4. A **sí** puede crear un negocio en el suyo (que el fix no rompa el caso legítimo).

Si algo falla, el mensaje dice cuál política violó o qué fila apareció de más/de
menos — no hace falta leer el schema para saber qué se rompió.

### Archivos

- `supabase/tests/rls.test.ts` — el test (Vitest + el driver `pg` directo, sin PostgREST).
- `supabase/tests/00-auth-shim.sql` — recrea lo mínimo de `auth.users`/`auth.uid()`
  y los roles `authenticated`/`anon` que un proyecto de Supabase real ya trae.
  Solo para este test; no es schema de producción.
- `supabase/tests/01-grants.sql` — los grants que Supabase da por defecto a esos
  roles (sin esto, RLS ni se pondría a prueba: fallaría por falta de permiso, no
  por política).

---

## Probar el borrado en cascada de `negocio_id` (`pnpm test:cascade`)

Mismo criterio que `pnpm test:rls`: corre las migraciones REALES contra el
Postgres desechable de `TEST_DATABASE_URL` (ver arriba cómo levantar una) y
prueba `0006_negocio_id_fk.sql` (T-08) de punta a punta:

```bash
pnpm test:cascade
```

1. Inserta un negocio y un lead/sesión enlazados solo por `business_slug`
   (0001-0005, sin la columna `negocio_id` todavía) — así como ya existen en
   producción.
2. Aplica `0006` y verifica que el **backfill** completó `negocio_id` de ese
   lead/sesión correctamente, y que un lead con un slug que no matchea ningún
   negocio queda con `negocio_id` en `null` (no inventa una relación).
3. Borra el negocio y verifica que el lead y la sesión **desaparecen** (el
   `on delete cascade` de la FK), sin afectar al lead huérfano.

`supabase/tests/cascade.test.ts` reusa `00-auth-shim.sql` de la sección
anterior (no necesita `01-grants.sql`: todas las queries corren como dueño de
las tablas, no hay RLS de por medio en este test).
