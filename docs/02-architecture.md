# 02 - Arquitectura

## Idea en una frase

Un **core genérico** que hace funcionar el bot para cualquier negocio, más una capa de
**personalización en dos ejes** que se toca sin modificar el core:

- **Rubro** (qué vende el negocio) → `src/businesses/<slug>/config.ts`
- **Plataforma** (por dónde habla) → `src/core/channels/<plataforma>/`

## Estructura de carpetas

```
src/
  core/                          # GENÉRICO — sin negocio ni plataforma específicos
    types.ts                     # tipos normalizados de todo el sistema
    engine/                      # el "cerebro" (funciones puras, testeables)
      templating.ts              # render de plantillas: "Hola {{nombre}}"
      lead-state.ts              # máquina de estados del lead
      intake.ts                  # interpreta el mensaje entrante
      responder.ts               # decide qué responder según la config
      followups.ts               # calcula seguimientos pendientes (2h/1d/3d)
    channels/                    # adaptadores de PLATAFORMA
      channel.ts                 # interfaz Channel (parse / send)
      mock.ts                    # canal de prueba (tests + simulador)
      whatsapp/                  # adaptador WhatsApp Cloud API
        verify.ts                #   verificación del webhook + firma
        parse.ts                 #   payload de Meta → IncomingMessage
        send.ts                  #   OutgoingMessage → Graph API
    storage/                     # adaptadores de ALMACENAMIENTO
      repository.ts              # interfaz LeadRepository (contrato)
      adapters/
        json.ts                  # default: un archivo JSON (cero setup)
  businesses/                    # PERSONALIZACIÓN POR RUBRO (solo datos)
    registry.ts                  # phone_number_id / slug → config
    estetica-bella/config.ts     # negocio de ejemplo (estética)
    _template/config.ts          # copiar esto para un negocio nuevo
  app/                           # capa Next.js (traduce HTTP ↔ motor)
    api/webhook/whatsapp/route.ts  # GET verify + POST receive
    api/dev/simulate/route.ts      # (solo dev) probar sin Meta
    admin/page.tsx                 # panel solo-lectura de leads
scripts/simulate.ts              # CLI del simulador (pnpm sim)
```

## El principio que sostiene todo

> **`core/` no importa nada de `next/*` ni del SDK de Meta.**

El motor solo conoce **tipos normalizados**. Los adaptadores son los únicos que traducen
hacia/desde el mundo exterior:

- Un **Channel** traduce el payload de la plataforma ↔ `IncomingMessage`/`OutgoingMessage`.
- Un **LeadRepository** traduce las operaciones de lead ↔ el almacenamiento concreto.

Gracias a esto:
- El **mismo motor** funciona con WhatsApp, con el canal *mock* (tests) o el simulador.
- Se puede **testear sin levantar un servidor** ni llamar a Meta.
- Agregar Instagram = un adaptador nuevo. Agregar Sheets = un adaptador nuevo. El core
  no cambia.

## Tipos principales (`core/types.ts`)

- `Service` — un servicio del negocio (nombre, descripción, precio, duración…).
- `BusinessConfig` — toda la personalización de un negocio (servicios, mensajes, tiempos
  de seguimiento, link de agenda opcional…).
- `Lead` — un interesado: contacto, servicio de interés, **estado**, fechas, etc.
- `LeadState` — `nuevo | interesado | agendado | pagado | perdido | recurrente`. El funnel de
  conversación captura servicio → nombre → fecha → **confirmación**; al confirmar, el lead pasa de
  `interesado` a `agendado`.
- `IncomingMessage` / `OutgoingMessage` — mensajes normalizados (agnósticos de plataforma).
- `FollowUp` — un seguimiento pendiente calculado por el motor.

## Flujo de un mensaje (de punta a punta)

```
1. Cliente escribe          →  Meta hace POST /api/webhook/whatsapp
2. channels/whatsapp/verify →  valida la firma X-Hub-Signature-256
3. channels/whatsapp/parse  →  payload de Meta → IncomingMessage
4. businesses/registry      →  phone_number_id → BusinessConfig del negocio
5. engine/intake            →  interpreta el mensaje (¿menú? ¿servicio? ¿dato?)
6. storage (LeadRepository) →  crea/actualiza el Lead + su estado
7. engine/responder         →  decide OutgoingMessage(s) según la config
8. channels/whatsapp/send   →  envía la respuesta por la Graph API
```

El motor (pasos 5–7) es **puro**: recibe datos, devuelve decisiones. Los efectos
(guardar, enviar) ocurren en los adaptadores (pasos 6 y 8). Eso es lo que lo hace
testeable y reutilizable.

## Probar sin Meta (canal mock)

El simulador (`pnpm sim "..."`) usa `channels/mock.ts` en lugar de WhatsApp y un
repositorio JSON local. Ejecuta exactamente el mismo motor, así que valida toda la
conversación **offline**:

```
pnpm sim → mock channel → engine → json repo → respuestas impresas en consola
```

## Personalización: los dos ejes

| Quiero… | Toco… | NO toco |
|---------|-------|---------|
| Vender a un negocio nuevo (otro rubro) | `businesses/<slug>/config.ts` + `registry.ts` | `core/` |
| Soportar una plataforma nueva (Instagram) | `core/channels/<plataforma>/` | `engine/`, negocios |
| Cambiar dónde se guardan los leads (Sheets) | `core/storage/adapters/<x>.ts` | `engine/`, negocios |

Onboarding de un negocio: ver [`04-add-new-business.md`](./04-add-new-business.md).
