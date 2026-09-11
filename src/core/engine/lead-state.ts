/**
 * Máquina de estados del lead.
 *
 * Modela el embudo de ventas: nuevo → interesado → agendado → pagado →
 * recurrente, con `perdido` como rama posible desde cualquier estado activo.
 * Es lógica pura (sin I/O), fácil de testear.
 */

import type { LeadState } from "@/core/types";

/** Transiciones permitidas desde cada estado. */
const ALLOWED_TRANSITIONS: Record<LeadState, LeadState[]> = {
  nuevo: ["interesado", "perdido"],
  interesado: ["agendado", "perdido"],
  agendado: ["pagado", "interesado", "perdido"],
  pagado: ["recurrente", "perdido"],
  recurrente: ["agendado", "pagado", "perdido"],
  // Un lead perdido puede reactivarse si vuelve a escribir.
  perdido: ["interesado", "nuevo"],
};

/** Próxima acción sugerida para el negocio según el estado (para el panel /admin). */
const NEXT_ACTION: Record<LeadState, string> = {
  nuevo: "Enviar bienvenida",
  interesado: "Enviar disponibilidad / hacer seguimiento",
  agendado: "Confirmar cita",
  pagado: "Preparar y brindar el servicio",
  recurrente: "Ofrecer próxima sesión",
  perdido: "Reactivar con promoción",
};

/** ¿Es válida la transición `from → to`? */
export function canTransition(from: LeadState, to: LeadState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Aplica una transición. Devuelve el nuevo estado si es válida; si no, lanza.
 * Transicionar a un estado idéntico es un no-op válido (devuelve el mismo).
 */
export function transition(from: LeadState, to: LeadState): LeadState {
  if (from === to) return to;
  if (!canTransition(from, to)) {
    throw new Error(`Transición de estado inválida: ${from} → ${to}`);
  }
  return to;
}

/** Texto de "próxima acción" para mostrar en el panel. */
export function nextAction(state: LeadState): string {
  return NEXT_ACTION[state];
}

/** Estados en los que el lead ya no necesita seguimiento de venta. */
const CLOSED_STATES: ReadonlySet<LeadState> = new Set<LeadState>([
  "agendado",
  "pagado",
  "perdido",
  "recurrente",
]);

/** ¿El lead sigue "abierto" (candidato a seguimiento)? */
export function needsFollowUp(state: LeadState): boolean {
  return !CLOSED_STATES.has(state);
}
