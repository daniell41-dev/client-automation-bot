/**
 * Prompt y parseo de la respuesta de `describePaymentReceipt` (T-24.2).
 *
 * Mismo criterio que `image-prompt.ts`: nunca se confía a ciegas en la
 * salida del modelo. A diferencia de `describeImage` (que busca un producto
 * real en el catálogo), acá no hay nada contra qué cruzar el resultado — por
 * eso el prompt es explícito en que está PROHIBIDO opinar sobre si el pago
 * es válido (§1.6 del plan, no negociable): el modelo transcribe, nunca
 * verifica.
 */

import {
  paymentReceiptSchema,
  type PaymentReceiptDescription,
} from "@/core/ai/payment-receipt-schema";

export function buildPaymentReceiptPrompt(): string {
  return [
    "Sos un asistente que TRANSCRIBE lo que dice un comprobante de pago",
    "(Nequi, Bancolombia, Pago Móvil u otro) que mandó un cliente por WhatsApp.",
    "NO opinás si el pago es válido, real o si corresponde aprobarlo — eso lo",
    "decide una persona, nunca vos. Tu trabajo es solo digitar lo que se lee.",
    "",
    "Devolvé ÚNICAMENTE un JSON con esta forma exacta, sin texto alrededor ni",
    "bloques de markdown. Todos los campos son opcionales salvo \"legible\" —",
    "si no se alcanza a leer un dato, omitilo, nunca lo inventes:",
    '{"banco": string opcional, "referencia": string opcional, "monto": number opcional, "moneda": "COP"|"VES" opcional, "fechaISO": string ISO 8601 opcional, "telefonoDestino": string opcional, "nombreDestino": string opcional, "legible": "completo"|"parcial"|"ilegible"}',
    "",
    '"legible" es "ilegible" si la imagen no permite leer nada aprovechable,',
    '"parcial" si se lee algo pero no todos los datos, "completo" si se leen',
    "todos los datos típicos de un comprobante (referencia, monto, fecha).",
  ].join("\n");
}

/**
 * Parsea y valida la respuesta cruda del modelo. Tolera que venga envuelta
 * en fences de markdown. Cualquier cosa que no sea un JSON válido contra
 * `paymentReceiptSchema` es `null`.
 */
export function parsePaymentReceipt(raw: string): PaymentReceiptDescription | null {
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

  const result = paymentReceiptSchema.safeParse(json);
  return result.success ? result.data : null;
}
