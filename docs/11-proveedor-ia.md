# 11 - Proveedor de IA: cadena de respaldo (Gemini → Groq → Cerebras)

Responde a una pregunta operativa concreta: **¿qué IA gratis usar para que negocios en Venezuela (y en general) no tengan fluctuaciones ni inestabilidad con el bot?**

## El problema que resolvió esto

El bot usaba un solo proveedor (Groq) con un modelo fijo (`llama-3.3-70b-versatile`). El 26 de agosto de 2026, Groq dio de baja ese modelo del free/dev tier. La llamada a la IA empezó a fallar en silencio y el bot cayó a las plantillas crudas sin que nadie lo notara — eso explicó, en su momento, una respuesta que se leía "sin pulir" en una prueba real.

La lección: **depender de un solo proveedor es en sí mismo un riesgo de inestabilidad**, más allá de qué tan bueno sea ese proveedor. La solución no es "elegir el proveedor perfecto" sino armar una **cadena de respaldo**: si el primero falla (caído, sin cuota, modelo dado de baja), el sistema prueba automáticamente el siguiente. El bot nunca se cae por la IA — en el peor caso, cae a las plantillas de texto sin reformular, que es el comportamiento normal desde el día uno.

## Investigación: ¿qué proveedor gratis es estable desde Venezuela?

La llamada a la IA la hace **el servidor** (Vercel/Node), no el celular del negocio — el bloqueo por IP geográfica no aplica. Lo que sí importa es: (a) poder crear la cuenta/key desde Venezuela sin fricción, y (b) que los términos de servicio del proveedor no prohíban el uso — si los prohíben, el riesgo real es un **cierre de cuenta sin aviso**, que es la inestabilidad que se quiere evitar.

| Proveedor | Venezuela | Límite gratis (por key) | Veredicto |
|---|---|---|---|
| **Google Gemini** | **Sí — en la [lista oficial de regiones](https://ai.google.dev/gemini-api/docs/available-regions) de Google** | Nivel "flash-lite": del orden de ~30 RPM y ~1.500 req/día (varía por modelo/tier, ver nota abajo) | **Primario.** Único con soporte oficial explícito → cero riesgo de ToS. Sin tarjeta. |
| Groq | Sin lista pública de países; términos de export control genéricos (zona gris) | Modelos "instant"/pequeños: del orden de varios miles de req/día | Respaldo. Rápido (hardware LPU), pero su catálogo de modelos rota (ver nota abajo). |
| Cerebras | Sin lista pública; términos OFAC/EAR genéricos (zona gris) | ~1M tokens/día, ~30 RPM, contexto 8K | Respaldo opcional. |
| OpenRouter | Aplica restricciones regionales de sus proveedores subyacentes | 50 req/día sin fondos | Descartado: cuota mínima sin tarjeta, no vale la pena como tercer respaldo. |
| Cloudflare Workers AI | Sin restricción conocida | ~15-25 llamadas LLM/día | Descartado: insuficiente. |
| Mistral (La Plateforme) | Europeo; pide verificación por teléfono | ~1B tokens/mes | No integrado; alternativa si hiciera falta un cuarto proveedor. |
| Ollama (propio) | Sin dependencia externa | Ilimitado; requiere servidor propio | Soportado vía preset `custom` — soberanía total, útil si un negocio no quiere depender de terceros. |

**Decisión: Gemini como primario, Groq y Cerebras como respaldo.** No hace falta elegir uno solo — configurar dos o tres keys gratis (todas sin tarjeta) es lo que da la estabilidad real.

### Nota sobre el catálogo de modelos (cambia seguido)

Los IDs de modelo y sus límites gratis **no son estables** — ya pasó una vez con `llama-3.3-70b-versatile` (dado de baja) y con `gemini-2.5-flash-lite` (retirado para cuentas nuevas), y va a volver a pasar. Groq en particular da de baja modelos con relativa frecuencia (ver [console.groq.com/docs/deprecations](https://console.groq.com/docs/deprecations)) — es parte de por qué no conviene depender solo de Groq, ni memorizar un nombre de modelo como si fuera fijo.

**`pnpm ai:doctor` es la fuente de verdad, no esta tabla ni el código.** Si reporta que el modelo configurado (o el default) ya no existe, imprime la lista real de modelos disponibles para tu key — copiá uno de ahí a `GEMINI_MODEL`/`GROQ_MODEL`/`CEREBRAS_MODEL` en `.env.local` y listo.

### Alarma automática de deprecación (T-15)

Esperar a notarlo en una prueba real (como pasó con Groq, ver arriba) no escala.
`.github/workflows/ai-doctor-alarm.yml` corre `pnpm ai:doctor` en CI los **lunes y
jueves a las 09:00 UTC**, contra los secrets `GEMINI_API_KEY`/`GROQ_API_KEY`/
`CEREBRAS_API_KEY` del repo, y si algún proveedor **configurado** (tiene su key)
falla, abre un issue con el error exacto y el catálogo de modelos disponibles
para esa key (o comenta el issue ya abierto, si la alarma sigue sonando). Un
proveedor sin key configurada nunca genera issue — eso no es una falla, es que
ese proveedor no está en uso.

- `ai-doctor.ts` escribe ese reporte estructurado cuando corre con
  `AI_DOCTOR_REPORT_PATH` seteada (solo en CI; en la terminal no cambia nada).
- `ai-doctor-report-issue.ts` lo lee y abre/comenta el issue vía la API de
  GitHub, usando el `GITHUB_TOKEN` que Actions inyecta solo.

**Probarla a mano:** desde la pestaña Actions → "Alarma de deprecación de
modelos IA" → *Run workflow*, completar el input `groq_model` con algo
inexistente (p. ej. `modelo-que-no-existe`) y correrlo — Groq va a fallar la
llamada real y el workflow debe abrir un issue nuevo con ese error exacto.

## Cómo se usa en el código

Gemini, Groq y Cerebras exponen el mismo protocolo (`POST {baseURL}/chat/completions`, formato OpenAI). Un solo adaptador (`OpenAICompatibleProvider`) sirve para los tres — y para un Ollama propio — solo cambiando `baseURL`/`model`.

```
createLLMProvider()                              (factory.ts)
  │
  ├─ arma un OpenAICompatibleProvider por cada *_API_KEY presente
  │  (presets.ts: gemini / groq / cerebras; o AI_CUSTOM_* para uno propio)
  │
  ├─ 0 keys  → null                (bot usa plantillas, como siempre)
  ├─ 1 key   → ese provider solo
  └─ 2+ keys → ResilientProvider([...]) en el orden configurado
                 │
                 ├─ prueba el primero
                 ├─ si LANZA (red/HTTP/timeout) → prueba el siguiente
                 └─ si todos lanzan → enhance() devuelve el borrador,
                    extractDateTime()/interpret() devuelven null
```

Un detalle importante: un `null` que devuelve un proveedor **sin lanzar** (p. ej. "esta fecha es ambigua, no hay hora clara") es una respuesta VÁLIDA, no un fallo — no dispara el paso al siguiente proveedor de la cadena. Solo un error real (timeout, HTTP 4xx/5xx, red caída) mueve la cadena al siguiente.

## Configurar

En el portal no hay UI para esto (son credenciales de infraestructura, no de un negocio puntual) — van en `.env.local` / las Environment Variables de Vercel:

```bash
# Primario recomendado — key gratis en https://aistudio.google.com/apikey
GEMINI_API_KEY=
# GEMINI_MODEL=            # default: gemini-3.5-flash-lite

# Respaldo — key gratis en https://console.groq.com/keys
GROQ_API_KEY=
# GROQ_MODEL=              # default: openai/gpt-oss-20b

# Respaldo opcional — key gratis en https://cloud.cerebras.ai
# CEREBRAS_API_KEY=

# Proveedor propio OpenAI-compatible (p. ej. Ollama). Deben ir las 3 juntas.
# AI_CUSTOM_BASE_URL=
# AI_CUSTOM_API_KEY=
# AI_CUSTOM_MODEL=

# Orden de la cadena (default: gemini,groq,cerebras,custom).
# AI_PROVIDER_ORDER=
```

Verificar que funciona: `pnpm ai:doctor` — revisa cada proveedor configurado (auth + una llamada real de `enhance()` y otra de `runAgent()`) y muestra el error EXACTO si algo falla, sin adivinar.

### Modelos que razonan: mismo `reasoning_effort` en todos los métodos

Gemini 3 y `gpt-oss` (el modelo de Groq) "piensan" antes de responder — **incluso si no se les manda `reasoning_effort` en absoluto**: el campo no es "on/off", es "cuánto"; omitirlo no lo apaga, deja el nivel por defecto del proveedor (más alto que "low"). `presets.ts` configura `reasoning_effort: "low"` para Gemini y Groq (Cerebras no lo necesita, no razona) y **todos** los métodos (`enhance()`, `interpret()`, `extractDateTime()`, `runAgent()`) mandan ese mismo valor.

`runAgent()` (modo agente: prompt largo + JSON estricto, ver `docs/13-modo-agente.md`) además usa `max_tokens` holgado (1600) y timeout propio (20s por defecto vs. 8s del resto), porque esos tokens de razonamiento salen del mismo presupuesto que la respuesta y razonar tarda más cuanto más crece el catálogo + historial.

Que sea el MISMO valor en todos los métodos no fue la primera opción — se llegó ahí probando las otras dos con keys reales y viendo que fallaban peor (`pnpm ai:doctor`, sept-2026):

1. **No mandar nada** en `enhance()`/`interpret()`/`extractDateTime()` (asumiendo que un prompt corto no necesita razonar): **Gemini hacía timeout** en `enhance()` (>8s en un prompt corto) y **Groq devolvía vacío** (`finish_reason=length`, se quedaba sin `max_tokens` pensando) — omitir el campo no apaga el razonamiento, así que fue peor que mandar algo.
2. **Mandar `"none"` explícito** para apagarlo del todo: **ninguno de los dos proveedores lo acepta**. Groq devuelve HTTP 400 con el mensaje textual `` `reasoning_effort` must be one of `low`, `medium`, or `high` ``; Gemini también 400 (`INVALID_ARGUMENT`) con el mismo cambio. `"none"` no es un valor válido del enum en ninguno de los dos.

Con esas dos descartadas por evidencia real, queda un límite conocido (no un bug): con Groq (`openai/gpt-oss-20b`) y `reasoning_effort: "low"`, `enhance()` puede devolver el borrador **sin ningún cambio** — el modelo, con el esfuerzo bajo pero no nulo, opta por la respuesta "más segura" frente a las reglas de "no inventar/conservar datos" en vez de arriesgarse a reformular. Si hace falta que `enhance()` con Groq reformule de verdad, el próximo experimento (no probado todavía) sería `"medium"` específicamente para Groq vía `AI_REASONING_EFFORT`.

Configurable sin tocar código:

```bash
# "low" | "medium" | "high" (valores reales del enum — "none" NO es válido,
# los proveedores lo rechazan con HTTP 400). Vacío ("") fuerza a NO mandar
# el campo — no lo recomendamos: peor que "low" (ver arriba).
# AI_REASONING_EFFORT=

# Timeout de runAgent en ms (default 20000). En Vercel Hobby el límite de
# función es 10s: si migrás ahí, bajalo o pasate a un plan con más tiempo.
# AI_AGENT_TIMEOUT_MS=
```

Si `pnpm ai:doctor` reporta que `runAgent` falla con "respuesta vacía (finish_reason=length)", el modelo se quedó sin tokens pensando: `reasoning_effort` ya está en el mínimo válido (`"low"`) y `max_tokens` (1600) es fijo en código, así que no hay una variable de entorno que lo arregle — hace falta subir ese `max_tokens` en `openai-compatible.ts`. Si en cambio la IA tarda pero eventualmente respondería (no es un problema de tokens sino de tiempo), subí `AI_AGENT_TIMEOUT_MS`.

### Cuota compartida entre negocios

Una sola key de Gemini sirve a **todos** los negocios del SaaS (no es por negocio). El límite gratis diario es la suma de TODOS los mensajes con IA de TODOS los negocios ese día — no un cupo por negocio. El intérprete de intención (`docs/12-comprension-del-cliente.md`) solo consume cuota cuando el motor determinista no entendió, no en cada mensaje, así que el consumo real es menor a "un request por mensaje". Suficiente para arrancar; al escalar, subir a un tier pago o dejar que la cadena de respaldo reparta la carga entre proveedores.

## Archivos clave

- `src/core/ai/presets.ts` — `baseURL` + modelo por defecto de cada proveedor.
- `src/core/ai/openai-compatible.ts` — el adaptador único (`fetch` puro, sin SDK).
- `src/core/ai/resilient.ts` — la cadena de respaldo.
- `src/core/ai/factory.ts` — `createLLMProvider()`, arma la cadena desde el entorno.
- `scripts/ai-doctor.ts` — diagnóstico agnóstico de proveedor.
- `scripts/ai-doctor-report-issue.ts` — abre/comenta el issue de la alarma (T-15) a partir del reporte de `ai-doctor.ts`.
- `.github/workflows/ai-doctor-alarm.yml` — la corre programada (lunes/jueves) y permite dispararla a mano.
