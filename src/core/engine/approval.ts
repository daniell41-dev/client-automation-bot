/**
 * Interpreta la respuesta de la DUEÑA a un aviso de pedido pendiente (T-21,
 * PR5). Distinto de `isAffirmative` (que interpreta cualquier no-"sí" como
 * negativa dentro del funnel de CLIENTE): acá un mensaje ambiguo tiene que
 * devolver `null` explícito — no se rechaza (ni se acepta) un pedido por
 * accidente solo porque la dueña escribió algo que no se entendió.
 */

import { isAffirmative, isNegative } from "@/core/engine/intake";

export type RespuestaDueña = "aceptado" | "rechazado" | null;

export function interpretarRespuestaDueña(text: string): RespuestaDueña {
  if (isAffirmative(text)) return "aceptado";
  if (isNegative(text)) return "rechazado";
  return null;
}
