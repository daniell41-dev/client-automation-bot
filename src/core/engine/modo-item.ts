/**
 * Qué camino sigue el bot cuando el cliente elige un ítem del catálogo (T-21).
 *
 * La decisión es del ÍTEM, no del negocio. Un taller mecánico agenda el
 * service Y vende el repuesto en la misma conversación: un enum por negocio
 * (`negocio.objetivo = "cita" | "pedido"`) habría que romperlo apenas entre
 * el primer taller. Con la decisión en el ítem, un negocio mixto sale gratis.
 *
 * Los tres escalones de abajo existen para que NINGÚN negocio ya cargado
 * cambie de comportamiento al desplegar esto: sin `modo` ni `catalogo`, todo
 * sigue siendo una cita, exactamente como antes.
 */

import type { CatalogoConfig, ModoItem, Service } from "@/core/types";

/**
 * Resuelve el camino de un ítem, en orden de especificidad:
 *
 *   1. `item.modo` — lo que el dueño declaró para ESTE ítem, gana siempre.
 *   2. `item.reservable === true` — el flag que ya existía y que ya significaba
 *      "esto se reserva". Los cuatro servicios de estética y el `_template` lo
 *      traen explícito, así que caen acá sin migrar nada.
 *   3. `catalogo.modoPorDefecto` del rubro, y si tampoco está, "cita" — el
 *      default preserva el comportamiento anterior a T-21.
 */
export function modoDelItem(item: Service, catalogo?: CatalogoConfig): ModoItem {
  if (item.modo) return item.modo;
  if (item.reservable === true) return "cita";
  return catalogo?.modoPorDefecto ?? "cita";
}

/** ¿Este ítem ocupa un tramo de agenda y crea un evento de calendario? */
export function esCita(item: Service, catalogo?: CatalogoConfig): boolean {
  return modoDelItem(item, catalogo) === "cita";
}

/**
 * ¿El negocio tiene ítems de los dos caminos? Es el caso del taller (agenda
 * el service, vende el repuesto) y lo que impide asumir un objetivo único por
 * negocio en el resto del sistema.
 */
export function catalogoMixto(items: Service[], catalogo?: CatalogoConfig): boolean {
  let hayCita = false;
  let hayPedido = false;
  for (const item of items) {
    if (modoDelItem(item, catalogo) === "cita") hayCita = true;
    else hayPedido = true;
    if (hayCita && hayPedido) return true;
  }
  return false;
}
