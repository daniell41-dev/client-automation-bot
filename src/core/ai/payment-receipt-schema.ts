/**
 * Esquema (Zod) de lo que un modelo con visión devuelve al leer un
 * comprobante de pago (T-24.2, `docs/15-plan-vision-tienda.md` §1.6/§4).
 *
 * TODOS los campos son opcionales a propósito: una captura borrosa o
 * recortada es el caso NORMAL, no la excepción. `legible` es lo único
 * obligatorio, para que el motor sepa si hay algo aprovechable o hay que
 * pedir una foto más clara.
 *
 * A propósito NO tiene un campo de validez/confianza sobre si el pago es
 * real — eso es exactamente lo que la decisión §1.6 prohíbe. Este esquema
 * es transcripción, nunca verificación: lo que decide si un pago se acepta
 * es la dueña (T-24.4) o un webhook firmado (T-24.5), nunca este método.
 */

import { z } from "zod";

export const paymentReceiptSchema = z.object({
  banco: z.string().optional(),
  /** Tal cual aparece en la captura, sin normalizar (eso es responsabilidad de quien llama). */
  referencia: z.string().optional(),
  monto: z.number().optional(),
  moneda: z.enum(["COP", "VES"]).optional(),
  /** ISO 8601 de la fecha/hora que TRAE la captura, no de cuándo se procesó. */
  fechaISO: z.string().optional(),
  telefonoDestino: z.string().optional(),
  nombreDestino: z.string().optional(),
  /**
   * `"ilegible"` significa que no hay nada aprovechable — el motor le pide
   * al cliente que reenvíe una foto más clara, nunca adivina los campos que
   * faltan.
   */
  legible: z.enum(["completo", "parcial", "ilegible"]),
});

export type PaymentReceiptDescription = z.infer<typeof paymentReceiptSchema>;
