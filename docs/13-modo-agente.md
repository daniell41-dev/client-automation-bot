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

Siete acciones posibles: `elegir_servicio`, `guardar_nombre`, `guardar_fecha`, `guardar_modalidad`, `confirmar`, `fuera_de_contexto` y `reiniciar`. La IA puede declarar varias en un mismo turno — si el cliente da todos sus datos de una ("quiero uñas, soy Carlos, mañana"), el bot no necesita tres idas y vueltas para procesarlo.

`reiniciar` merece mención aparte: es la **única forma que tiene la IA de CORREGIR** un dato guardado, porque las demás acciones solo agregan. Cuando el cliente dice "yo no pedí nada", "ese no es mi nombre" o "cambié de idea", la IA la declara y se borra lo capturado. Si en el mismo turno también declara `elegir_servicio`, el servicio nuevo sobrevive (el borrado se aplica primero). Además, el motor detecta de forma determinista las palabras explícitas ("cancelar", "empezar de nuevo") y limpia **antes** de llamar a la IA, para que el agente vea un estado en blanco.

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
| `reiniciar` | Borra lo capturado (mismo `id`/contacto). Se aplica ANTES que el resto de las acciones del turno. |

### La IA tiene que saber lo que ya pasó

Dos datos del estado son tan importantes como el catálogo, y van en el prompt:

- **`yaConfirmado`**: si la cita/pedido ya está cerrada, el prompt lo dice de forma destacada — "NO vuelvas a pedir datos ni a confirmar; si quiere algo más, tratalo como reserva nueva". Sin esto la IA no tiene forma de saberlo y vuelve a preguntar cosas que el cliente ya respondió.
- **Los datos ya capturados** (nombre, servicio, fecha, modalidad), para que no los vuelva a pedir.

### Respuesta en JSON garantizada (y qué pasa si no lo es)

La llamada usa `response_format: {"type":"json_object"}` (soportado por Gemini, Groq y Cerebras) además de pedirlo en el prompt, y un `max_tokens` holgado (1600 — ver `docs/11-proveedor-ia.md` sobre por qué los modelos que razonan necesitan margen extra). Aun así, tres cosas pueden salir mal, y cada una se maneja distinto en vez de tirar el turno entero:

- **Una acción con un `tipo` desconocido, o a la que le falta un campo**: se descarta solo esa acción — el resto de la respuesta (el texto y las demás acciones) se procesa normal. Antes, un solo `{"tipo":"hacer_magia"}` invalidaba todo el JSON.
- **El modelo envolvió el JSON en prosa** ("Acá tenés: {...} espero que sirva"): se rescata el objeto `{...}` balanceado.
- **La respuesta se cortó a la mitad** (JSON truncado): se rescata SOLO el texto de `"respuesta"` por regex, con `acciones: []` — nunca se adivina un cambio de estado a partir de algo roto, pero el cliente recibe una respuesta de la IA en vez de caer a una plantilla que no viene a cuento.

Si ninguno de los rescates funciona, `parseAgentResponse` devuelve el motivo (`vacio` / `no-json` / `schema`) y un recorte del texto crudo — ver la sección de diagnóstico más abajo.

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

## Reglas rápidas y brevedad: el agente también las respeta

`config.ai.reglas` (keyword → respuesta oficial, ver `docs/07-*`/el editor de "Respuestas y flujos") se le pasa al prompt como referencia: *"si el cliente pregunta por esto, esta es la respuesta oficial del negocio — podés adaptar el tono, no el dato"*. No es un atajo por keyword como en modo guiado (`matchRule`): el agente sigue razonando, pero ya no improvisa una política de envíos o un horario que el negocio ya definió textualmente.

El prompt también instruye brevedad explícita (2-3 frases, tono de WhatsApp, sin markdown ni listas largas salvo que pidan el menú) — la misma idea que la regla `04-brevedad.md` de `enhance()`, que el prompt del agente no heredaba. Además de fidelidad al modo guiado, respuestas más cortas corren menos riesgo de truncarse (ver la sección de arriba).

## Cuándo cae al motor determinista, y cómo diagnosticarlo

El síntoma típico de una caída silenciosa: el bot "olvida" datos que ya tenía (vuelve a pedir el nombre, ofrece un menú genérico) a mitad de una conversación que había empezado bien. Antes esto no dejaba ningún rastro — hoy sí:

- **Logs**: cada causa deja una línea distinta en la consola del servidor:
  - `[<proveedor>] runAgent devolvió algo inválido (<motivo>): <texto crudo recortado>` — el motivo es `vacio`, `no-json` o `schema` (ver la sección de arriba sobre los rescates: si `vacio`/`no-json` se pudo rescatar SOLO el texto, esto no aparece — en su lugar sale la línea de "rescató" de abajo).
  - `[<proveedor>] runAgent rescató el texto de una respuesta rota/truncada (sin acciones)` — se salvó una respuesta parcial; no es un fallo del turno, pero vale la pena saber que pasó seguido (podría indicar que conviene subir `AI_AGENT_TIMEOUT_MS` o bajar `AI_REASONING_EFFORT`).
  - `[AI] <proveedor> falló (runAgent), probando el siguiente` — solo con 2+ proveedores configurados (`ResilientProvider`); con uno solo, el fallo ya quedó logueado por el punto anterior.
  - `[Agent] runAgent falló (se agotó el tiempo de espera), cae al motor determinista` — timeout específicamente.
  - `[Agent] la IA no devolvió un turno válido, cae al motor determinista` — línea final, siempre presente cuando el turno termina en modo guiado por culpa del agente (a diferencia de un guiado configurado a propósito, que no loguea nada).
- **`pnpm ai:doctor` — paso 4**: además de probar `enhance()`, hace una llamada real de `runAgent()` con el catálogo de estética-bella (mismo `reasoning_effort`/timeout que usaría el bot real) e imprime la latencia y el JSON crudo. Es la prueba que puede fallar aunque el paso 3 (`enhance()`) pase — un prompt más largo + `response_format` estricto es un caso distinto.
- **En vivo, sin leer logs**: `handleIncoming()` devuelve `{ messages, modo, motivoFallback }` en vez de solo los mensajes. `/api/dev/simulate` lo expone en `_debug.modo`/`_debug.motivoFallback`, y el chat de `/demo` muestra una nota discreta bajo la respuesta del bot cuando cayó a guiado (en desarrollo se muestra siempre, para ver también cuándo SÍ contestó el agente). `motivoFallback` viene vacío cuando el guiado fue una decisión del negocio (`ai.modo: "guiado"`), no un fallback real.

## Lo que NO cambia

- El almacenamiento (Supabase/Sheets/JSON), el calendario, las notificaciones, los seguimientos automáticos: todos siguen leyendo el mismo `Lead` de siempre.
- El costo de IA: ya se pagaba una llamada por mensaje (para `enhance()`); ahora se paga la misma llamada, pero para que decida en vez de solo parafrasear.

## Pendiente (fuera de esta fase)

- UI en el portal para que el dueño active/desactive el modo agente y edite el `rubro` sin tocar código (por ahora son campos de config, no hay toggle visual).
- Los seguimientos automáticos (`followUps`) siguen siendo mensajes fijos con `{{variables}}`, no pasan por el agente.

## Archivos clave

- `src/core/ai/agent-schema.ts` — el contrato JSON (Zod): acciones válidas y su forma; `acciones` es tolerante (descarta las inválidas, no invalida toda la respuesta).
- `src/core/ai/agent-prompt.ts` — `buildAgentSystemPrompt()` (catálogo, reglas rápidas, brevedad), `buildAgentUserMessage()`, `parseAgentResponse()` (nunca confía a ciegas en la salida del modelo; incluye los rescates de JSON roto/truncado).
- `src/core/ai/agent.ts` — `runAgentTurn()`: aplica las acciones validadas, deriva la etapa visible del lead, cuenta los desvíos de tema, loguea por qué cae al motor determinista.
- `src/core/ai/provider.ts` — `AgentTurnInput`/`AgentServiceSummary`/`AgentLeadState`, método `runAgent()` en `ILLMProvider`.
- `src/core/ai/openai-compatible.ts` / `resilient.ts` — implementan `runAgent()` (con la cadena de respaldo tratando un JSON inválido como fallo real, a diferencia de `interpret`/`extractDateTime`); loguean el motivo exacto de cada fallo.
- `src/core/ai/factory.ts` — `resolveReasoningEffort()`/`resolveAgentTimeoutMs()` (también los usa `ai-doctor.ts` para probar con la misma config que producción).
- `src/core/handle.ts` — decide qué modo usar por turno, arma el fallback, y devuelve `{ messages, modo, motivoFallback }`.
- `scripts/ai-doctor.ts` — paso 4: llamada real de `runAgent()`.
- `src/core/types.ts` — `BusinessConfig.rubro`, `BotAIConfig.modo`, `Lead.offTopicCount`.
