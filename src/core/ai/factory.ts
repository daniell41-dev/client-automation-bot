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
import { AI_PRESETS, type PresetName } from "@/core/ai/presets";
import { ResilientProvider } from "@/core/ai/resilient";

type ProviderName = PresetName | "custom";

const DEFAULT_ORDER: ProviderName[] = ["gemini", "groq", "cerebras", "custom"];

/** Construye el provider "custom" (Ollama u otro) desde AI_CUSTOM_*. */
function buildCustomProvider(): ILLMProvider | null {
  const apiKey = process.env.AI_CUSTOM_API_KEY;
  const baseURL = process.env.AI_CUSTOM_BASE_URL;
  const model = process.env.AI_CUSTOM_MODEL;
  if (!apiKey || !baseURL || !model) return null;
  return new OpenAICompatibleProvider({ name: "custom", baseURL, apiKey, model });
}

/** Construye el provider de un preset conocido (gemini/groq/cerebras) desde <NOMBRE>_*. */
function buildPresetProvider(name: PresetName): ILLMProvider | null {
  const envPrefix = name.toUpperCase();
  const apiKey = process.env[`${envPrefix}_API_KEY`];
  if (!apiKey) return null;
  const preset = AI_PRESETS[name];
  const model = process.env[`${envPrefix}_MODEL`] || preset.defaultModel;
  return new OpenAICompatibleProvider({ name, baseURL: preset.baseURL, apiKey, model });
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
 * Crea el proveedor de IA activo: uno solo si hay una única key configurada,
 * o una cadena de respaldo (`ResilientProvider`) si hay varias. `null` si no
 * hay ninguna key — el motor cae a plantillas sin romperse.
 */
export function createLLMProvider(): ILLMProvider | null {
  const order = resolveOrder();
  const providers = order
    .map(buildProvider)
    .filter((p): p is ILLMProvider => p !== null);

  if (providers.length === 0) return null;
  return providers.length === 1 ? providers[0] : new ResilientProvider(providers);
}
