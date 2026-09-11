/**
 * Extracción de fecha/hora desde texto libre del cliente.
 *
 * Separado del proveedor (Groq) para poder testear sin red las dos piezas con
 * riesgo: el prompt y, sobre todo, la VALIDACIÓN de lo que devuelve el modelo.
 * Nunca confiamos ciegamente en la salida del LLM: si no es un ISO 8601 con
 * offset válido, devolvemos null y el flujo cae al fallback (no se agenda).
 */

import type { DateExtractionInput } from "@/core/ai/provider";

/** ISO 8601 con componente horario y offset obligatorio (Z o ±HH:MM). */
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Construye el system prompt para que el modelo devuelva ISO 8601 o NONE. */
export function buildDateExtractionPrompt(input: {
  nowISO: string;
  timezone: string;
}): string {
  return `Hoy es ${input.nowISO} (zona horaria ${input.timezone}).
Tu tarea: convertir el texto de un cliente sobre cuándo quiere su cita en una fecha y hora EXACTAS.

Reglas:
- Respondé ÚNICAMENTE con la fecha/hora en formato ISO 8601 con offset de zona horaria (ejemplo: 2026-06-30T15:00:00-05:00).
- Resolvé expresiones relativas ("mañana", "el viernes", "pasado mañana") usando la fecha de hoy indicada arriba.
- Si el cliente da una hora ambigua (ej. "a las 3" sin AM/PM), asumí el horario comercial más probable (las 3 de la tarde).
- Si NO hay una hora concreta o el texto es demasiado ambiguo para fijar día y hora, respondé exactamente: NONE
- No agregues explicaciones, comillas ni texto extra. Solo el ISO o NONE.`;
}

/**
 * Valida y normaliza la salida cruda del modelo.
 * Devuelve el ISO si es una fecha/hora con offset válida y real; si no, null.
 */
export function parseExtractedDateTime(raw: string): string | null {
  const cleaned = raw.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.toUpperCase() === "NONE") return null;
  if (!ISO_WITH_OFFSET.test(cleaned)) return null;
  // Forma válida pero ¿fecha real? (rechaza 2026-13-40, etc.)
  if (Number.isNaN(Date.parse(cleaned))) return null;
  return cleaned;
}

/** Re-export del tipo de entrada para comodidad de los consumidores. */
export type { DateExtractionInput };
