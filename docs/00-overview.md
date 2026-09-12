# 00 - Overview del proyecto

## ¿Qué es esto?

**client-automation-bot** es una **mini-fábrica de atención y ventas** para negocios
pequeños. En vez de que el dueño esté pegado al celular respondiendo lo mismo 80 veces
al día, el sistema:

1. **Recibe** interesados (leads) que escriben por WhatsApp.
2. Les **responde** al instante con la información correcta (servicios, precios, duración).
3. **Captura** sus datos (nombre, servicio de interés, fecha tentativa).
4. Los **organiza** por estado (nuevo, interesado, agendado, perdido, recurrente…).
5. Calcula el **seguimiento** a quienes preguntaron pero no agendaron (2h / 1 día / 3 días).

> La frase que lo resume: *un sistema que recibe interesados, los organiza, les responde,
> les da seguimiento y ayuda a convertirlos en ventas sin que el dueño tenga que hacerlo
> todo manualmente.*

La herida concreta que resuelve: **"se me pierden clientes porque no respondo a tiempo o
no hago seguimiento"**.

## El problema (ejemplo: centro de estética)

Una clienta escribe preguntando por una limpieza facial. La dueña está atendiendo y
responde tarde. La clienta pregunta horarios, se demora la respuesta, se enfría y nadie
le vuelve a escribir. **Venta perdida.** Esto se repite todos los días.

## La solución (flujo del MVP)

```
Cliente escribe por WhatsApp
        │
        ▼
Webhook  →  Motor (intake + responder)  →  Repositorio de leads (JSON)
        │            │
        │            ├─ responde con menú / info del servicio / pide datos
        │            └─ crea/actualiza el lead con su estado
        ▼
Respuesta automática al cliente
        │
        ▼
Seguimientos calculados (2h / 1d / 3d)   ── (el envío real es fase 2)
        │
        ▼
Panel /admin (solo lectura): el negocio ve sus leads y estados
```

**Para probar sin esperar a Meta:** existe un simulador offline.

```bash
pnpm sim "Hola, quiero info de limpieza facial"
```

Esto inyecta el mensaje por un canal *mock* y muestra la conversación completa + el lead
creado, **sin tokens, sin webhook público y sin red**. Ideal para demostrar el producto
mientras se tramita la cuenta de WhatsApp Business.

## La idea central: CORE genérico + personalización sin tocar el core

El valor de largo plazo es poder revender esto a muchos negocios. Por eso la arquitectura
separa lo que **nunca cambia** de lo que **se personaliza por cliente**:

- **CORE** (`src/core/`) — el motor de conversación, los estados del lead, el cálculo de
  seguimientos y los adaptadores de canal/almacenamiento. **Es genérico**: no sabe de
  estética ni de seguros, ni de WhatsApp en particular.
- **Personalización** — dos ejes que se tocan **sin modificar el core**:
  - **Rubro** → `src/businesses/<slug>/config.ts` (servicios, precios, mensajes, tiempos).
  - **Plataforma** → `src/core/channels/<plataforma>/` (WhatsApp hoy; Instagram mañana).

Cliente nuevo = un archivo de config + registrar su slug.
Plataforma nueva = un adaptador de canal. El core no se toca.

> Detalle técnico en [`02-architecture.md`](./02-architecture.md).

## Alcance del MVP (esta entrega)

**Incluye:** responder automático con menú, captura de datos, info por servicio, estados
del lead, lógica de seguimiento, simulador offline, adaptador WhatsApp, almacenamiento
JSON, negocio de ejemplo (estética) + plantilla para negocios nuevos, webhook y un panel
`/admin` de solo lectura.

**Fase 2 (fuera de alcance por ahora):** recordatorios y postventa automáticos (requieren
cron + plantillas aprobadas de Meta), agenda con reserva en vivo, reporte semanal,
adaptador de Instagram, almacenamiento en Google Sheets/Airtable y despliegue real.

## Documentación relacionada

| Documento | Para qué |
|-----------|----------|
| [`01-git-flow.md`](./01-git-flow.md) | Flujo de Git y GitHub del equipo |
| [`02-architecture.md`](./02-architecture.md) | Cómo está construido por dentro |
| [`03-team-guide.md`](./03-team-guide.md) | Cómo trabajar en el repo |
| [`04-add-new-business.md`](./04-add-new-business.md) | Agregar un negocio nuevo |
| [`05-whatsapp-setup.md`](./05-whatsapp-setup.md) | Conectar WhatsApp Cloud API |
| [`06-testing-guide.md`](./06-testing-guide.md) | Probar el bot con el simulador (`pnpm sim`) |
| [`07-google-sheets.md`](./07-google-sheets.md) | Persistencia en Google Sheets por negocio |
| [`08-supabase-saas.md`](./08-supabase-saas.md) | Supabase, portal, back office y deploy gratis en Vercel |
| [`design/README.md`](./design/README.md) | Handoff de diseño "Nexo": pantallas, tokens y mapeo a Supabase (`design/TASKS.md` es el backlog, `design/screenshots/` las 18 capturas) |
| [`10-notificaciones-y-pedidos.md`](./10-notificaciones-y-pedidos.md) | Notificación WhatsApp a la dueña + modalidad de pedido |
| [`11-proveedor-ia.md`](./11-proveedor-ia.md) | IA gratis y estable (cadena de respaldo Gemini → Groq → Cerebras) |
| [`12-comprension-del-cliente.md`](./12-comprension-del-cliente.md) | Español de chat + intérprete IA |
| [`13-modo-agente.md`](./13-modo-agente.md) | Modo agente: la IA decide acciones validadas, no solo reformula texto |
