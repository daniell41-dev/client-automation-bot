/**
 * Ciclo de vida de un PEDIDO (T-30, ADR-004).
 *
 * Separado del estado del lead a propósito: el lead es la conversación con
 * el cliente (puede hacer varios pedidos en el tiempo), el pedido es UNA
 * venta concreta con número propio. Mientras los dos estaban fundidos, la
 * dueña no tenía a qué pedido referirse al responder SÍ y el bot resolvía
 * el más viejo pendiente (FIFO) — el agujero que aprovecha un pantallazo
 * falso. Lógica pura (sin I/O), mismo criterio que `lead-state.ts`.
 */

import type { EstadoPedido } from "@/core/storage/pedido-repository";

/** Transiciones permitidas desde cada estado. */
const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  // Esperando que el cliente pague (link de Wompi o foto del comprobante).
  // Puede pasar directo a "aprobado": la dueña puede haber verificado el
  // pago por fuera (efectivo, su app del banco) sin que llegue la foto.
  esperando_pago: ["por_verificar", "aprobado", "rechazado", "vencido"],
  // Hay comprobante (o no se pide): la dueña tiene que decidir.
  por_verificar: ["aprobado", "rechazado", "vencido"],
  // "listo" es opcional: un pedido que se entrega en el acto salta directo.
  aprobado: ["listo", "entregado"],
  listo: ["entregado"],
  // Finales: un pedido cerrado no se reabre — volver a pedir es un pedido nuevo.
  entregado: [],
  rechazado: [],
  vencido: [],
};

const FINALES: ReadonlySet<EstadoPedido> = new Set<EstadoPedido>([
  "entregado",
  "rechazado",
  "vencido",
]);

const PENDIENTES_DE_DECISION: ReadonlySet<EstadoPedido> = new Set<EstadoPedido>([
  "esperando_pago",
  "por_verificar",
]);

export function puedeTransicionarPedido(desde: EstadoPedido, hacia: EstadoPedido): boolean {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

/**
 * Aplica una transición; lanza si no está permitida. Lanzar (en vez de
 * ignorar) es lo que evita, por ejemplo, que un webhook atrasado de Wompi
 * "apruebe" un pedido que la dueña ya rechazó. Ir al mismo estado es no-op.
 */
export function transicionarPedido(desde: EstadoPedido, hacia: EstadoPedido): EstadoPedido {
  if (desde === hacia) return hacia;
  if (!puedeTransicionarPedido(desde, hacia)) {
    throw new Error(`Transición de pedido inválida: ${desde} → ${hacia}`);
  }
  return hacia;
}

/** ¿El pedido ya se cerró (entregado, rechazado o vencido)? */
export function pedidoCerrado(estado: EstadoPedido): boolean {
  return FINALES.has(estado);
}

/** ¿El pedido todavía espera que la dueña (o la pasarela) decida? */
export function pedidoPendienteDeDecision(estado: EstadoPedido): boolean {
  return PENDIENTES_DE_DECISION.has(estado);
}
