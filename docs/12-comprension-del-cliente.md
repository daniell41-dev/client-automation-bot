# 12 - Comprensión del cliente: español de chat + intérprete IA

Responde a otro problema real de la prueba en producción: los clientes no escriben "bien" — abrevian, cambian letras, se comen tildes, escriben con el teléfono corriendo. El bot tiene que entenderlos igual y dejar una respuesta clara, **sin depender de que la IA esté disponible** (el motor determinista tiene que funcionar solo, siempre).

Por eso la comprensión se resuelve en **dos capas**, en este orden:

1. **Diccionario determinista** (siempre activo, sin IA, sin cuota): cubre las abreviaturas y errores más comunes del español de chat.
2. **Intérprete IA** (red de seguridad, solo si hay una key de IA configurada): cuando el diccionario no alcanza y el motor cae al "no te entendí", la IA traduce el mensaje a una opción real del negocio.

## Capa 1: español de chat (determinista)

### El problema

`"k pasa si?"`, `"q te parece"`, `"hla, kiero info d uñas"`, `"mñn a las 3"`, `"siii"`. El motor (`intake.ts`) reconocía texto normalizado (minúsculas, sin tildes) pero no abreviaturas — "kiero" no es "quiero" para una comparación de substring.

### Cómo funciona

`src/core/engine/chat-spanish.ts` expone `expandChatSpanish(text)`:

1. **Colapsa letras repetidas** (3+): `"holaaa"` → `"hola"`, `"siiii"` → `"si"`.
2. **Separa puntuación pegada**: `"hola?"` → `"hola ?"`.
3. **Expande abreviaturas por token completo** (nunca dentro de otra palabra, para que "y" no toque la "y" de "hoy"): `k/q → que`, `xq/pq → porque`, `pa/xa → para`, `tb → también`, `mñn → mañana`, `hy → hoy`, `grax → gracias`, `oki → ok`… (lista completa y editable en `ABBREVIATIONS`).

Un detalle importante: `expandChatSpanish` **preserva tildes y mayúsculas** de las palabras que no son abreviaturas. Eso permite dos usos distintos de la misma función:

- **Para reconocer intención** (`normalizeMessage` en `intake.ts` = `normalize(expandChatSpanish(texto))`): el resultado se dobla al final (minúsculas, sin tildes) para comparar — perder una tilde ahí no importa, es solo comparación interna.
- **Para mostrarle la fecha de vuelta al cliente** (`normalizeDateText`): SÍ importa. `"Creo que el sábado en la tarde."` se convierte en `"el sábado en la tarde"` (con tilde), no en una versión doblada y fea.

`isGreeting`, `isAffirmative`, `matchService`, `matchRule` y `matchEntrega` usan `normalizeMessage` sobre el **texto del cliente únicamente** — nunca sobre nombres de servicio ni keywords que configuró el negocio (eso seguiría comparando con `normalize()` a secas, para no alterar lo que el dueño escribió a propósito).

`AFFIRMATIVE_WORDS` (para el paso de confirmación) también suma variantes regionales: `vale`, `va`, `hecho`, `sale`, `simón`, `sisas`.

### La fecha se limpia antes de guardarse

Antes, el texto del cliente se guardaba tal cual en `lead.tentativeDate` y se insertaba crudo en la plantilla:

> ~~¿Te confirmo tu cita de Uñas para Puede ser hoy ?, Carlos?~~

`normalizeDateText(text)` (en `intake.ts`) limpia eso:

1. Expande abreviaturas (`normalizeDateText` usa `expandChatSpanish` directo, sin doblar tildes).
2. Quita puntuación suelta al inicio/final (`¿ ? ¡ ! . ,`).
3. Quita muletillas iniciales — una o varias veces: "puede ser", "podría ser", "creo que", "quiero", "para", "el día"…
4. Baja a minúscula solo la primera letra.

```
"Puede ser hoy ?"                  → "hoy"
"Podría ser mñn a las 3 pm!"       → "mañana a las 3 pm"
"Creo que el sábado en la tarde."  → "el sábado en la tarde"
"el viernes"                       → "el viernes"        (sin cambios)
"???"                              → ""                  (se re-pregunta)
```

Ahora:

> **¿Te confirmo tu cita de Uñas para hoy, Carlos?** 💜

Si el resultado queda vacío (el cliente solo mandó puntuación o una muletilla sin contenido, p. ej. `"???"` o `"no sé"`), el bot **vuelve a preguntar la fecha** en vez de agendar una cita sin fecha real — el lead se queda en `esperando_fecha`.

### Agregar una abreviatura nueva

Editar `ABBREVIATIONS` en `src/core/engine/chat-spanish.ts` (claves ya "dobladas": minúsculas, sin tildes ni ñ — usar `foldAccents` como referencia). Cubierto por `chat-spanish.test.ts`.

## Capa 2: intérprete IA (red de seguridad, opcional)

### El problema que queda

El diccionario cubre abreviaturas *conocidas*, pero no puede adivinar frases completamente distintas: `"me interesa lo de las manos"` (en vez de "uñas"), `"necesito que me dejen la cara brillante"` (en vez de "limpieza facial"). Ahí el motor determinista legítimamente no tiene cómo saber qué servicio es.

### Cómo funciona

Cuando `respond()` (en `responder.ts`) **no reconoce el mensaje** — cae al fallback final, o no encuentra ninguna modalidad de entrega en `esperando_entrega` — marca `unrecognized: true` en su resultado. `handleIncoming` (en `handle.ts`), si hay IA disponible, entonces:

1. Calcula las opciones válidas con `interpretableOptions(stage, config)`:
   - en `esperando_entrega` → las opciones de `config.pedidos.opciones`;
   - en cualquier otra etapa → los nombres de los servicios disponibles + los `botonesMenu` configurados.
2. Le pide a la IA (`llm.interpret({ text, options, stage, history })`) que elija **una de esas opciones exactas**, o `NONE`.
3. Si la IA elige una opción real, **corre el motor de nuevo, una sola vez**, con ese texto en vez del original — el motor entonces la reconoce normalmente (por ejemplo, `matchService` encuentra el servicio por su nombre exacto).
4. Si la IA responde `NONE`, no está disponible, o falla, el comportamiento es el de **siempre**: el fallback normal (o, en `esperando_entrega`, el texto del cliente se acepta tal cual — ese paso ya era permisivo antes de esto).

```
Cliente: "necesito que me dejen la cara brillante"
   │
   ▼ motor: no matchea ningún servicio → unrecognized: true
   │
   ▼ interpretableOptions(stage, config) → ["Limpieza facial", "Uñas"]
   │
   ▼ llm.interpret(...) → "Limpieza facial"
   │
   ▼ se vuelve a correr el motor con text = "Limpieza facial"
   │
   ▼ matchService la reconoce → sigue el funnel normal (pide el nombre, etc.)
```

### Por qué es seguro (nunca inventa nada)

`parseInterpretation(raw, options)` (en `interpret.ts`) **nunca confía a ciegas** en lo que devuelve el modelo: solo acepta el texto EXACTO de una de las opciones (tolerando mayúsculas/espacios/comillas de más). Cualquier otra cosa — incluida una opción "parecida" pero no idéntica — se descarta como `null`. Mismo patrón defensivo que ya usaba `parseExtractedDateTime` para las fechas.

El motor sigue siendo el único que decide el estado del lead: la IA solo **traduce texto libre a una opción válida**, nunca decide directamente qué servicio o modalidad usar.

### Costo en cuota

Solo se llama a `interpret()` cuando el motor determinista **no entendió** — no en cada mensaje. Un negocio con clientes que escriben razonablemente bien casi no va a gastar cuota extra en esto.

## Capa 3: el motor no secuestra mensajes que no son la respuesta esperada

### El problema

Antes, cuando el lead estaba en una etapa de captura (`esperando_nombre`, `esperando_fecha`, `esperando_confirmacion`…), **cualquier** texto se guardaba como si fuera la respuesta a esa pregunta. Un cliente que preguntaba "¿me repites las opciones?" en medio del flujo quedaba con eso guardado literalmente como su fecha de cita:

> ~~¿Te confirmo tu cita de Uñas para me repites por fa las opciones que hay, Carlos?~~

Peor aún: con la IA activa, esta reformulaba ese dato sin sentido por algo que "sonaba mejor" (p. ej. "hoy") — **inventando** un dato que no estaba en la conversación. Ver la regla reforzada en `02-conservar-datos.md`.

### Cómo funciona ahora

Cada etapa de captura (`esperando_nombre`, `esperando_entrega`, `esperando_fecha`, `esperando_confirmacion`) primero chequea si el mensaje es una **interrupción** en vez de la respuesta esperada:

- **Pedido de menú** (`isMenuRequest`: "opciones", "qué servicios tienen", "repíteme"…) → el bot lista los servicios y **repite la pregunta pendiente**, sin tocar el dato ni la etapa.
- **Saludo** (`isGreeting`) → el bot saluda de vuelta y **repite la pregunta pendiente**, igual sin tocar nada.

Además, en `esperando_fecha` y `esperando_confirmacion`, el texto solo se guarda como fecha si **realmente parece una fecha** (`looksLikeDate`: días, meses, "hoy"/"mañana", horas, "en 20 minutos", un día suelto del mes…). Si no lo parece, se re-pregunta en vez de guardar cualquier cosa. En `esperando_confirmacion` esto además permite que el cliente cambie la fecha directamente ("mejor el sábado") sin un paso extra.

### Comando de reinicio

En cualquier etapa, el cliente puede escribir "cancelar", "reiniciar" o "empezar de nuevo" (`isResetRequest`) para arrancar de cero — mismo lead (mismo `id`/contacto), pero se borra nombre/servicio/fecha/modalidad y vuelve al menú de bienvenida. Es la vía de escape si la conversación quedó en un estado confuso.

## Archivos clave

- `src/core/engine/chat-spanish.ts` — diccionario + `expandChatSpanish()`.
- `src/core/engine/text-normalize.ts` — `foldAccents()`, compartido para evitar un import circular.
- `src/core/engine/intake.ts` — `normalizeMessage()`, `normalizeDateText()`, `looksLikeDate()`, `isMenuRequest()`, `isResetRequest()`.
- `src/core/engine/responder.ts` — `RespondResult.unrecognized`, `interpretableOptions()`, helper `interruption()` (usado en las 4 etapas de captura) y el comando de reinicio.
- `src/core/ai/interpret.ts` — `buildInterpretPrompt()`, `parseInterpretation()`.
- `src/core/ai/rules/global/02-conservar-datos.md` — regla anti-invención reforzada.
- `src/core/handle.ts` — wiring del reintento con IA.
