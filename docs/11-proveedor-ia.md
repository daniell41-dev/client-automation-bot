# 11 - Proveedor de IA: cadena de respaldo (Gemini → Groq → Cerebras)

Responde a una pregunta operativa concreta: **¿qué IA gratis usar para que negocios en Venezuela (y en general) no tengan fluctuaciones ni inestabilidad con el bot?**

## El problema que resolvió esto

El bot usaba un solo proveedor (Groq) con un modelo fijo (`llama-3.3-70b-versatile`). El 26 de agosto de 2026, Groq dio de baja ese modelo del free/dev tier. La llamada a la IA empezó a fallar en silencio y el bot cayó a las plantillas crudas sin que nadie lo notara — eso explicó, en su momento, una respuesta que se leía "sin pulir" en una prueba real.

La lección: **depender de un solo proveedor es en sí mismo un riesgo de inestabilidad**, más allá de qué tan bueno sea ese proveedor. La solución no es "elegir el proveedor perfecto" sino armar una **cadena de respaldo**: si el primero falla (caído, sin cuota, modelo dado de baja), el sistema prueba automáticamente el siguiente. El bot nunca se cae por la IA — en el peor caso, cae a las plantillas de texto sin reformular, que es el comportamiento normal desde el día uno.

## Investigación: ¿qué proveedor gratis es estable desde Venezuela?

La llamada a la IA la hace **el servidor** (Vercel/Node), no el celular del negocio — el bloqueo por IP geográfica no aplica. Lo que sí importa es: (a) poder crear la cuenta/key desde Venezuela sin fricción, y (b) que los términos de servicio del proveedor no prohíban el uso — si los prohíben, el riesgo real es un **cierre de cuenta sin aviso**, que es la inestabilidad que se quiere evitar.

| Proveedor | Venezuela | Límite gratis (por key) | Veredicto |
|---|---|---|---|
| **Google Gemini** | **Sí — en la [lista oficial de regiones](https://ai.google.dev/gemini-api/docs/available-regions) de Google** | `gemini-2.5-flash-lite`: ~30 RPM, ~1.500 req/día, 1M TPM | **Primario.** Único con soporte oficial explícito → cero riesgo de ToS. Sin tarjeta. |
| Groq | Sin lista pública de países; términos de export control genéricos (zona gris) | `llama-3.1-8b-instant`: 14.400 req/día | Respaldo. Rápido (hardware LPU), pero su catálogo de modelos rota (ver nota abajo). |
| Cerebras | Sin lista pública; términos OFAC/EAR genéricos (zona gris) | ~1M tokens/día, ~30 RPM, contexto 8K | Respaldo opcional. |
| OpenRouter | Aplica restricciones regionales de sus proveedores subyacentes | 50 req/día sin fondos | Descartado: cuota mínima sin tarjeta, no vale la pena como tercer respaldo. |
| Cloudflare Workers AI | Sin restricción conocida | ~15-25 llamadas LLM/día | Descartado: insuficiente. |
| Mistral (La Plateforme) | Europeo; pide verificación por teléfono | ~1B tokens/mes | No integrado; alternativa si hiciera falta un cuarto proveedor. |
| Ollama (propio) | Sin dependencia externa | Ilimitado; requiere servidor propio | Soportado vía preset `custom` — soberanía total, útil si un negocio no quiere depender de terceros. |

**Decisión: Gemini como primario, Groq y Cerebras como respaldo.** No hace falta elegir uno solo — configurar dos o tres keys gratis (todas sin tarjeta) es lo que da la estabilidad real.

### Nota sobre el catálogo de Groq

Groq da de baja modelos con relativa frecuencia (ver [console.groq.com/docs/deprecations](https://console.groq.com/docs/deprecations)) a medida que salen versiones nuevas — es parte de por qué no conviene depender solo de Groq. Si `pnpm ai:doctor` reporta que `GROQ_MODEL` ya no existe, revisa esa página y actualiza la variable en `.env.local`.

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
# GEMINI_MODEL=            # default: gemini-2.5-flash-lite

# Respaldo — key gratis en https://console.groq.com/keys
GROQ_API_KEY=
# GROQ_MODEL=              # default: llama-3.1-8b-instant

# Respaldo opcional — key gratis en https://cloud.cerebras.ai
# CEREBRAS_API_KEY=

# Proveedor propio OpenAI-compatible (p. ej. Ollama). Deben ir las 3 juntas.
# AI_CUSTOM_BASE_URL=
# AI_CUSTOM_API_KEY=
# AI_CUSTOM_MODEL=

# Orden de la cadena (default: gemini,groq,cerebras,custom).
# AI_PROVIDER_ORDER=
```

Verificar que funciona: `pnpm ai:doctor` — revisa cada proveedor configurado (auth + una llamada real) y muestra el error EXACTO si algo falla, sin adivinar.

### Cuota compartida entre negocios

Una sola key de Gemini sirve a **todos** los negocios del SaaS (no es por negocio). El límite gratis (~1.500 req/día en Flash-Lite) es la suma de TODOS los mensajes con IA de TODOS los negocios ese día — no 1.500 por negocio. El intérprete de intención (`docs/12-comprension-del-cliente.md`) solo consume cuota cuando el motor determinista no entendió, no en cada mensaje, así que el consumo real es menor a "un request por mensaje". Suficiente para arrancar; al escalar, subir a un tier pago o dejar que la cadena de respaldo reparta la carga entre proveedores.

## Archivos clave

- `src/core/ai/presets.ts` — `baseURL` + modelo por defecto de cada proveedor.
- `src/core/ai/openai-compatible.ts` — el adaptador único (`fetch` puro, sin SDK).
- `src/core/ai/resilient.ts` — la cadena de respaldo.
- `src/core/ai/factory.ts` — `createLLMProvider()`, arma la cadena desde el entorno.
- `scripts/ai-doctor.ts` — diagnóstico agnóstico de proveedor.
