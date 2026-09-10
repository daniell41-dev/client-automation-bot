# 13 - Modo agente: la IA decide, el motor valida

Responde al problema de fondo de los ajustes anteriores (`docs/12-comprension-del-cliente.md`): agregar cada vez más listas de keywords (`isMenuRequest`, `looksLikeDate`…) para que el bot "entienda" mensajes nuevos **no escala** y, sobre todo, desperdicia la IA — ya le pagamos una llamada por mensaje solo para que reformule el tono de una plantilla que el motor ya había decidido. La IA no podía responder una pregunta real, manejar una objeción, ni actuar distinto según el rubro del negocio.

## El cambio de arquitectura

**Antes** (modo "guiado", sigue existiendo):
```
mensaje → motor decide TODO con reglas fijas → borrador de plantilla → IA reformula el tono → respuesta
```

**Ahora** (modo "agente", default):
```
mensaje → contexto completo (catálogo real, horarios, knowledge, rubro,
          datos ya capturados, historial) → la IA razona y devuelve
          { respuesta, acciones[] } → el motor VALIDA cada acción contra
          el catálogo/estado real antes de aplicarla → se guarda
```

La IA ahora decide **qué pasó en el turno** (no reformula un borrador ya decidido). El motor determinista no desaparece: sigue siendo la red de seguridad si la IA falla, y sigue siendo quien **valida y aplica** cada acción — la IA nunca escribe el lead directamente, solo propone.

## El contrato: acciones, no texto libre

La IA responde con un JSON estricto (`agent-schema.ts`):

```json
{
  "respuesta": "¡Con gusto! ¿Cuál es tu nombre?",
  "acciones": [{ "tipo": "elegir_servicio", "servicioId": "unas" }]
}
```

Seis acciones posibles: `elegir_servicio`, `guardar_nombre`, `guardar_fecha`, `guardar_modalidad`, `confirmar`, `fuera_de_contexto`. La IA puede declarar varias en un mismo turno — si el cliente da todos sus datos de una ("quiero uñas, soy Carlos, mañana"), el bot no necesita tres idas y vueltas para procesarlo.

## Los guardrails (por qué es seguro)

Cada acción se valida en `agent.ts` contra el estado real **antes** de aplicarse — nunca se confía a ciegas en lo que devuelve el modelo, mismo criterio que ya usaban `parseExtractedDateTime`/`parseInterpretation`:

| Acción | Validación |
|---|---|
| `elegir_servicio` | El `servicioId` debe existir en el catálogo real y estar disponible. Si no, se ignora. |
| `guardar_nombre` | Se descarta si "parece" un saludo, un pedido de menú o un pedido de reinicio (reusa `isGreeting`/`isMenuRequest`/`isResetRequest` de `docs/12` — ya no son solo guardas del motor determinista, ahora también blindan al agente). |
| `guardar_fecha` | Solo se guarda si `looksLikeDate()` confirma que el texto habla de una fecha real (misma guarda de `docs/12`). |
| `guardar_modalidad` | Debe coincidir (exacto o vía `matchEntrega`) con una de las opciones reales configuradas. |
| `confirmar` | Solo se aplica si YA hay nombre + servicio + fecha (+ modalidad, si el negocio la usa). Si la IA la declara antes de tiempo, se ignora — el motor decide cuándo está realmente completo, no la IA. |
| `fuera_de_contexto` | Alimenta el contador de desvíos (ver abajo); no toca los datos del lead. |

El catálogo (precios, duraciones) y el `knowledge` del negocio van en el prompt como los **únicos** datos válidos, con instrucción explícita de no inventar otros — igual que el motor determinista nunca inventó un precio.

## Fuera de contexto: redirige dos veces, cierra a la tercera

Si el cliente se desvía completamente del negocio (política, chistes, otro tema ajeno), la IA declara `fuera_de_contexto` y **responde breve, redirigiendo** — el conteo real de cuántas veces pasó **lo lleva el código, no la IA** (más confiable que pedirle a un LLM que cuente turnos con precisión):

- 1ª y 2ª vez: se guarda `lead.offTopicCount` y se envía la respuesta que redactó la IA.
- 3ª vez seguida: el motor **fuerza** el cierre — descarta la respuesta de la IA, la reemplaza por un mensaje de despedida amable, y reinicia el lead (mismo `id`, datos capturados en blanco), pase lo que pase.
- Si el cliente vuelve a hablar del negocio en cualquier momento, el contador vuelve a 0.
- **Una vez ya confirmada la cita/pedido, esto no se activa**: una charla informal después de agendar no debe borrar una reserva ya hecha.

## Rubro: la IA actúa distinto según el negocio

`BusinessConfig.rubro` (opcional, texto libre como `"restaurante"` o `"estética y belleza"`) se le pasa a la IA en el prompt para que actúe con el criterio de ese rubro — puramente informativo, no cambia el comportamiento del motor. Ya configurado en los negocios de ejemplo (`estetica-bella`, `restaurante-sabores`).

## El interruptor: modo "guiado"

`BusinessConfig.ai.modo`: `"agente"` (default, no hace falta escribirlo) o `"guiado"` (el funnel paso a paso de siempre, sin que la IA decida acciones). Sirve como plan B: si un negocio necesita un guion estricto, o la IA se porta rara con un cliente puntual, se apaga el modo agente sin tocar código — igual que el toggle de "Bot activo/Pausa".

El modo agente requiere, además de `ai.enabled !== false` y `modo !== "guiado"`: una key de IA configurada (`llm`), `sessionRepo` (para el historial) y una `persona` configurada para el canal. Si falta cualquiera de esas tres cosas, cae automáticamente al modo guiado — sin error, sin romper la conversación.

## La red de seguridad (nunca se cae)

- Si `llm.runAgent()` **lanza** (red, HTTP, timeout — la cadena de respaldo de `docs/11-proveedor-ia.md` ya intentó Gemini→Groq→Cerebras): `runAgentTurn()` devuelve `null`.
- Si el modelo no devuelve un JSON válido tras agotar la cadena: también `null`.
- Cuando `runAgentTurn()` devuelve `null`, `handleIncoming` cae al motor determinista (`respond()`) para ESE mensaje, con su propia red de seguridad de intérprete IA (`docs/12`). El cliente **siempre** recibe una respuesta.
- Al confirmar (por cualquiera de los dos modos), el resto del sistema sigue funcionando igual: se agenda en el calendario del negocio y se avisa a la dueña por WhatsApp (`docs/10-notificaciones-y-pedidos.md`) — la detección de "recién confirmado" mira `lead.stage`, que ambos modos dejan en `"datos_completos"` de la misma forma.

## Lo que NO cambia

- El almacenamiento (Supabase/Sheets/JSON), el calendario, las notificaciones, los seguimientos automáticos: todos siguen leyendo el mismo `Lead` de siempre.
- Las reglas rápidas (`config.ai.reglas`) — el motor determinista sigue existiendo completo como red de seguridad y modo alternativo.
- El costo de IA: ya se pagaba una llamada por mensaje (para `enhance()`); ahora se paga la misma llamada, pero para que decida en vez de solo parafrasear.

## Pendiente (fuera de esta fase)

- UI en el portal para que el dueño active/desactive el modo agente y edite el `rubro` sin tocar código (por ahora son campos de config, no hay toggle visual).
- Los seguimientos automáticos (`followUps`) siguen siendo mensajes fijos con `{{variables}}`, no pasan por el agente.

## Archivos clave

- `src/core/ai/agent-schema.ts` — el contrato JSON (Zod): acciones válidas y su forma.
- `src/core/ai/agent-prompt.ts` — `buildAgentSystemPrompt()`, `buildAgentUserMessage()`, `parseAgentResponse()` (nunca confía a ciegas en la salida del modelo).
- `src/core/ai/agent.ts` — `runAgentTurn()`: aplica las acciones validadas, deriva la etapa visible del lead, cuenta los desvíos de tema.
- `src/core/ai/provider.ts` — `AgentTurnInput`/`AgentServiceSummary`/`AgentLeadState`, método `runAgent()` en `ILLMProvider`.
- `src/core/ai/openai-compatible.ts` / `resilient.ts` — implementan `runAgent()` (con la cadena de respaldo tratando un JSON inválido como fallo real, a diferencia de `interpret`/`extractDateTime`).
- `src/core/handle.ts` — decide qué modo usar por turno y arma el fallback.
- `src/core/types.ts` — `BusinessConfig.rubro`, `BotAIConfig.modo`, `Lead.offTopicCount`.
