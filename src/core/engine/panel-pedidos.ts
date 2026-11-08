/**
 * Panel de pedidos (T-38): la herramienta de la dueña en los días pico.
 *
 * Funciones puras: qué pedido va en qué columna, cuándo se puede entregar y
 * qué se le dice al cliente cuando el pedido avanza. La página del portal
 * solo dibuja lo que esto decide.
 */

import type { Pedido } from "@/core/storage/pedido-repository";
import type { EstadoPedido } from "@/core/storage/pedido-repository";
import { esDomicilio } from "@/core/engine/flows/pedido";

export type ColumnaPanel = "por_verificar" | "en_preparacion" | "listo" | "entregado";

export const COLUMNAS_PANEL: { id: ColumnaPanel; titulo: string }[] = [
  { id: "por_verificar", titulo: "Por verificar" },
  { id: "en_preparacion", titulo: "En preparación" },
  { id: "listo", titulo: "Listo" },
  { id: "entregado", titulo: "Entregado" },
];

/** Columna de un estado; `null` para los que no se muestran (rechazado, vencido). */
export function columnaDe(estado: EstadoPedido): ColumnaPanel | null {
  switch (estado) {
    case "esperando_pago":
    case "por_verificar":
      return "por_verificar";
    case "aprobado":
      return "en_preparacion";
    case "listo":
      return "listo";
    case "entregado":
      return "entregado";
    default:
      return null;
  }
}

/**
 * Agrupa los pedidos por columna. "Por verificar" va ordenada por monto: la
 * dueña cruza esa lista con los movimientos de su app de Nequi, que también
 * se leen por monto. El resto, por número (orden de llegada).
 */
export function armarPanel(pedidos: Pedido[]): Record<ColumnaPanel, Pedido[]> {
  const panel: Record<ColumnaPanel, Pedido[]> = {
    por_verificar: [],
    en_preparacion: [],
    listo: [],
    entregado: [],
  };
  for (const pedido of pedidos) {
    const columna = columnaDe(pedido.estado);
    if (columna) panel[columna].push(pedido);
  }
  panel.por_verificar.sort((a, b) => b.total - a.total || a.numero - b.numero);
  panel.en_preparacion.sort((a, b) => a.numero - b.numero);
  panel.listo.sort((a, b) => a.numero - b.numero);
  panel.entregado.sort((a, b) => b.numero - a.numero);
  return panel;
}

export type ResultadoEntrega = { ok: true } | { ok: false; error: string };

/**
 * ¿Se puede entregar este pedido con este código? Es el control del
 * mostrador: solo un pedido aprobado (o listo) y solo contra el código que
 * recibió el cliente. Sin esto el código de retiro no protege nada.
 */
export function validarEntrega(pedido: Pedido, codigo: string): ResultadoEntrega {
  if (pedido.estado !== "aprobado" && pedido.estado !== "listo") {
    return { ok: false, error: `El pedido #${pedido.numero} no está aprobado: no se puede entregar.` };
  }
  if (!pedido.codigoRetiro) {
    return { ok: false, error: `El pedido #${pedido.numero} no tiene código de retiro.` };
  }
  if (codigo.replace(/\D/g, "") !== pedido.codigoRetiro) {
    return { ok: false, error: "El código no coincide. No entregues el pedido." };
  }
  return { ok: true };
}

/** Lo que recibe el cliente cuando la dueña marca el pedido como listo. */
export function mensajePedidoListo(pedido: Pedido): string {
  return esDomicilio(pedido.modalidad)
    ? `Tu pedido #${pedido.numero} ya va en camino 🛵 Tené a mano tu código de retiro.`
    : `Tu pedido #${pedido.numero} está listo para recoger 🙌 Mostrá tu código de retiro al llegar.`;
}
