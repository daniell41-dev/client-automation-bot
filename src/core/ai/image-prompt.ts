/**
 * Prompt y parseo de la respuesta de `describeImage` (T-23.3).
 *
 * Mismo criterio que `parseAgentResponse`: nunca se confía a ciegas en la
 * salida del modelo. A diferencia de esa, acá no hay un rescate de "solo el
 * texto" — si el JSON no valida contra el contrato, es `null` y punto, porque
 * no hay una `respuesta` de texto para el cliente que rescatar (el motor
 * decide qué decirle según el resultado de `buscar-producto.ts`, no el modelo).
 */

import { imageDescriptionSchema, type ImageDescription } from "@/core/ai/image-schema";

export function buildImageDescriptionPrompt(): string {
  return [
    "Sos un asistente que describe SOLO lo que se ve en una foto que mandó un",
    "cliente por WhatsApp. No decidís a qué producto del catálogo del negocio",
    "corresponde ni inventás texto que no esté visible en la imagen.",
    "",
    "Devolvé ÚNICAMENTE un JSON con esta forma exacta, sin texto alrededor ni",
    "bloques de markdown:",
    '{"tipoProducto": string, "marca": string opcional, "textoVisible": string[], "categoria": string opcional, "esRecipeMedico": boolean, "confianza": "alta"|"media"|"baja"}',
    "",
    '"esRecipeMedico" tiene que ser true si la imagen muestra una receta,',
    "fórmula o indicación de un profesional de salud — ante la duda, true.",
  ].join("\n");
}

/**
 * Parsea y valida la respuesta cruda del modelo. Tolera que venga envuelta en
 * fences de markdown (```json ... ```). Cualquier cosa que no sea un JSON
 * válido contra `imageDescriptionSchema` es `null`.
 */
export function parseImageDescription(raw: string): ImageDescription | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  if (!cleaned) return null;

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return null;
  }

  const result = imageDescriptionSchema.safeParse(json);
  return result.success ? result.data : null;
}
