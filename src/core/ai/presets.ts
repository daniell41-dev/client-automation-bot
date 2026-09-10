/**
 * Presets de proveedores OpenAI-compatibles gratuitos.
 *
 * Investigacion (ver docs/11-proveedor-ia.md): Gemini es el UNICO con
 * soporte oficial explicito en la lista de regiones de Google que incluye
 * Venezuela — cero riesgo de que cierren la cuenta por terminos de servicio.
 * Groq y Cerebras quedan como respaldo (zona gris de ToS, pero llamadas
 * hechas desde el servidor, no desde Venezuela).
 */

export interface AIPreset {
  /** URL base SIN `/chat/completions` (formato OpenAI-compatible). */
  baseURL: string;
  /** Modelo por defecto si no se especifica *_MODEL en el entorno. */
  defaultModel: string;
}

export const AI_PRESETS = {
  /** Google Gemini. Key gratis (sin tarjeta) en https://aistudio.google.com/apikey */
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash-lite",
  },
  /** Groq. Key gratis en https://console.groq.com/keys */
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant",
  },
  /** Cerebras. Key gratis en https://cloud.cerebras.ai */
  cerebras: {
    baseURL: "https://api.cerebras.ai/v1",
    defaultModel: "llama3.1-8b",
  },
} as const satisfies Record<string, AIPreset>;

export type PresetName = keyof typeof AI_PRESETS;
