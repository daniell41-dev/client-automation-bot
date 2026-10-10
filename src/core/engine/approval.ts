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

/**
 * T-31: la decisión de la dueña junto con A QUÉ pedido se refiere. Sin esto
 * el bot solo sabía "sí" o "no" y tenía que adivinar el pedido (FIFO).
 */
export interface DecisionDueña {
  decision: Exclude<RespuestaDueña, null>;
  /** Id del pedido, si tocó un botón del aviso. */
  pedidoId?: string;
  /** Número corto del pedido, si lo escribió ("SÍ 12"). */
  numero?: number;
}

/** Prefijos de los ids de botón que arma `notifyOwner` (`aprobar:<id>` / `rechazar:<id>`). */
export const BOTON_APROBAR = "aprobar:";
export const BOTON_RECHAZAR = "rechazar:";

/**
 * Interpreta la respuesta de la dueña con su referencia al pedido. El botón
 * manda sobre el texto: es lo único que no depende de cómo escribió. En el
 * texto se busca un número ("sí 12", "NO #12", "12 sí") y lo que queda se
 * interpreta con `interpretarRespuestaDueña`, que sigue devolviendo `null`
 * ante cualquier ambigüedad.
 */
export function interpretarDecisionDueña(text: string, botonId?: string): DecisionDueña | null {
  if (botonId?.startsWith(BOTON_APROBAR)) {
    return { decision: "aceptado", pedidoId: botonId.slice(BOTON_APROBAR.length) };
  }
  if (botonId?.startsWith(BOTON_RECHAZAR)) {
    return { decision: "rechazado", pedidoId: botonId.slice(BOTON_RECHAZAR.length) };
  }

  const coincidencia = text.match(/#?\s*(\d{1,6})\b/);
  const numero = coincidencia ? Number.parseInt(coincidencia[1], 10) : undefined;
  const sinNumero = coincidencia ? text.replace(coincidencia[0], " ") : text;

  // "Aprobar #12" / "Rechazar #12": el título de un botón que llegó sin id
  // (o escrito a mano copiando el botón).
  const palabras = sinNumero.trim().toLowerCase();
  const decision: RespuestaDueña = /^(aprobar|aprobado|aceptar|aceptado)\b/.test(palabras)
    ? "aceptado"
    : /^(rechazar|rechazado)\b/.test(palabras)
      ? "rechazado"
      : interpretarRespuestaDueña(sinNumero);
  if (!decision) return null;
  return numero !== undefined ? { decision, numero } : { decision };
}
