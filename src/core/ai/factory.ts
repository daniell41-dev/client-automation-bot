/**
 * Construye la cadena de proveedores de IA a partir de las variables de
 * entorno presentes. Orden por defecto: Gemini -> Groq -> Cerebras -> custom
 * (Ollama u otro OpenAI-compatible propio). Sobreescribible con
 * AI_PROVIDER_ORDER="groq,gemini" si se prefiere otro orden.
 *
 * Sin NINGUNA key configurada devuelve `null` — el bot sigue funcionando
 * con plantillas, igual que sin GROQ_API_KEY antes de esta migración.
 */

import type { ILLMProvider } from "@/core/ai/provider";
import { OpenAICompatibleProvider } from "@/core/ai/openai-compatible";
import { AI_PRESETS, type AIPreset, type PresetName } from "@/core/ai/presets";
import { ResilientProvider, type UsageContext } from "@/core/ai/resilient";

type ProviderName = PresetName | "custom";

const DEFAULT_ORDER: ProviderName[] = ["gemini", "groq", "cerebras", "custom"];

/**
 * `reasoning_effort` a usar: `AI_REASONING_EFFORT` manda sobre el default del
 * preset. Vacío (`AI_REASONING_EFFORT=`) fuerza a NO mandar el campo, incluso
 * si el preset trae uno propio. Exportada para que `ai-doctor.ts` construya
 * el mismo provider (con la misma config) que usaría el bot en producción.
 */
export function resolveReasoningEffort(presetDefault: string | undefined): string | undefined {
  const override = process.env.AI_REASONING_EFFORT;
  if (override === undefined) return presetDefault;
  return override === "" ? undefined : override;
}

/** Timeout de `runAgent` en ms: `AI_AGENT_TIMEOUT_MS` o el default del provider (20000). */
export function resolveAgentTimeoutMs(): number | undefined {
  const raw = process.env.AI_AGENT_TIMEOUT_MS;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Construye el provider "custom" (Ollama u otro) desde AI_CUSTOM_*. */
function buildCustomProvider(): ILLMProvider | null {
  const apiKey = process.env.AI_CUSTOM_API_KEY;
  const baseURL = process.env.AI_CUSTOM_BASE_URL;
  const model = process.env.AI_CUSTOM_MODEL;
  if (!apiKey || !baseURL || !model) return null;
  return new OpenAICompatibleProvider({
    name: "custom",
    baseURL,
    apiKey,
    model,
    reasoningEffort: resolveReasoningEffort(undefined),
    agentTimeoutMs: resolveAgentTimeoutMs(),
  });
}

/** Construye el provider de un preset conocido (gemini/groq/cerebras) desde <NOMBRE>_*. */
function buildPresetProvider(name: PresetName): ILLMProvider | null {
  const envPrefix = name.toUpperCase();
  const apiKey = process.env[`${envPrefix}_API_KEY`];
  if (!apiKey) return null;
  const preset: AIPreset = AI_PRESETS[name];
  const model = process.env[`${envPrefix}_MODEL`] || preset.defaultModel;
  return new OpenAICompatibleProvider({
    name,
    baseURL: preset.baseURL,
    apiKey,
    model,
    reasoningEffort: resolveReasoningEffort(preset.reasoningEffort),
    agentTimeoutMs: resolveAgentTimeoutMs(),
  });
}

function buildProvider(name: ProviderName): ILLMProvider | null {
  return name === "custom" ? buildCustomProvider() : buildPresetProvider(name);
}

function isProviderName(value: string): value is ProviderName {
  return (DEFAULT_ORDER as string[]).includes(value);
}

/** Orden de proveedores a intentar, desde AI_PROVIDER_ORDER o el default. */
function resolveOrder(): ProviderName[] {
  const raw = process.env.AI_PROVIDER_ORDER;
  if (!raw) return DEFAULT_ORDER;
  const names = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(isProviderName);
  return names.length > 0 ? names : DEFAULT_ORDER;
}

/**
 * Crea el proveedor de IA activo, envuelto siempre en `ResilientProvider`
 * (incluso con una sola key configurada). `null` si no hay ninguna key — el
 * motor cae a plantillas sin romperse.
 *
 * Antes, con una sola key, se devolvía el provider concreto pelado: si
 * `enhance()` lanzaba (red, timeout), el error subía sin capturar hasta el
 * try/catch del webhook, que descarta el mensaje ENTERO sin responderle
 * nada al cliente — el mismo fallo que con dos proveedores configurados sí
 * degradaba con gracia a la plantilla. Envolver siempre en
 * `ResilientProvider` (que ya atrapa el error y cae al borrador/`null`) es
 * lo que hace falta además para que T-07 pueda registrar el consumo en un
 * solo lugar, sin importar cuántos proveedores estén configurados.
 *
 * `usage`, si se pasa, atribuye cada llamada (y cada caída a plantilla) al
 * negocio indicado en `uso_ia` — ver `ResilientProvider`.
 */
export function createLLMProvider(usage?: UsageContext): ILLMProvider | null {
  const order = resolveOrder();
  const providers = order
    .map(buildProvider)
    .filter((p): p is ILLMProvider => p !== null);

  if (providers.length === 0) return null;
  return new ResilientProvider(providers, usage);
}
