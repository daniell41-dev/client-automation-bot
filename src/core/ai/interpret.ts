/**
 * Intérprete de intención: traduce un mensaje que el motor NO reconoció a
 * una de las opciones válidas del negocio.
 *
 * Separado del proveedor (igual que `date-extraction.ts`) para poder
 * testear sin red las dos piezas con riesgo: el prompt y, sobre todo, la
 * VALIDACIÓN de lo que devuelve el modelo. Nunca se confía a ciegas en la
 * salida del LLM: si no es EXACTAMENTE una de las opciones, se descarta.
 */

import type { InterpretInput } from "@/core/ai/provider";

/** Construye el system prompt: elegir una opción exacta, o NONE. */
export function buildInterpretPrompt(
  input: Pick<InterpretInput, "options" | "stage">,
): string {
  const lista = input.options.map((o, i) => `${i + 1}. ${o}`).join("\n");
  return `Sos un traductor de intención para un bot de atención al cliente.
El cliente escribió un mensaje que el sistema NO pudo reconocer automáticamente
(etapa actual: ${input.stage}).

Tu ÚNICA tarea: decidir a cuál de estas opciones se refiere, si a alguna.

Opciones válidas:
${lista}

Reglas estrictas:
- Respondé ÚNICAMENTE con el texto EXACTO de una opción de la lista de arriba
  (letra por letra, tal cual está escrita), o con NONE si el mensaje no
  corresponde claramente a ninguna.
- No agregues comillas, numeración, explicaciones ni texto extra.
- NUNCA inventes una opción que no esté en la lista.`;
}

/**
 * Valida y normaliza la salida cruda del modelo contra la lista de opciones.
 * Devuelve el texto EXACTO de la opción (tal cual la definió el negocio) o
 * `null` si el modelo respondió NONE, algo vacío o algo que no está en la
 * lista (se rechaza cualquier invención, aunque "suene" parecida).
 */
export function parseInterpretation(
  raw: string,
  options: string[],
): string | null {
  const cleaned = raw.trim().replace(/^["'\`]+|["'\`]+$/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.toUpperCase() === "NONE") return null;

  const exact = options.find((o) => o === cleaned);
  if (exact) return exact;

  // Tolerante a mayúsculas/espacios extra, pero NUNCA a substring parcial:
  // evita que "Retirar" solo dispare por casualidad si hay dos opciones
  // parecidas ("Retirar en el local" vs "Retirar y comer en el local").
  const loose = options.find(
    (o) => o.trim().toLowerCase() === cleaned.toLowerCase(),
  );
  return loose ?? null;
}
