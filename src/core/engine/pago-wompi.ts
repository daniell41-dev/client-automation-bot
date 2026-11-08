/**
 * Motor de decisión ante un evento de Wompi ya verificado (T-24.5, Nivel 2).
 * Función PURA, sin IA y sin I/O: recibe el estado que trae el webhook y si
 * el pedido YA estaba confirmado, devuelve qué corresponde hacer. Quien
 * llama (`handle.ts`) es el único que toca el stock/el lead — acá no hay
 * side-effects, solo la decisión.
 *
 * Con `APPROVED` verificado, el bot SÍ puede confirmar sin intervención de
 * la dueña — es el único camino del plan donde eso está permitido (§4,
 * Nivel 2: certeza criptográfica, no un OCR).
 */

export type EstadoWompi = "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING";

export type AccionWompi = "confirmar" | "rechazar" | "ninguna";

export interface DecisionWompi {
  accion: AccionWompi;
}

const ESTADOS_RECHAZO: ReadonlySet<EstadoWompi> = new Set(["DECLINED", "VOIDED", "ERROR"]);

/**
 * `yaConfirmado` cubre la idempotencia (Wompi reintenta el mismo evento, o
 * manda varios eventos para la misma transacción a medida que cambia de
 * estado): un pedido que ya se confirmó no vuelve a tocarse, sin importar
 * qué diga el evento — nunca se descuenta el stock dos veces.
 */
export function decidirAccionWompi(estado: EstadoWompi, yaConfirmado: boolean): DecisionWompi {
  if (yaConfirmado) return { accion: "ninguna" };
  if (estado === "APPROVED") return { accion: "confirmar" };
  if (ESTADOS_RECHAZO.has(estado)) return { accion: "rechazar" };
  // "PENDING" (o cualquier estado futuro no contemplado): esperar el próximo evento.
  return { accion: "ninguna" };
}
