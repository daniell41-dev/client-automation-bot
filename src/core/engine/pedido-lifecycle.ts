/**
 * Cierre inmediato del pedido aceptado (T-21/PR5).
 *
 * A diferencia de una cita (`appointment-lifecycle.ts`, que se cierra sola
 * recién cuando pasa la fecha o transcurren varios días), un pedido no tiene
 * "cuándo se entregó" que esperar: el requisito del dueño del producto es que
 * la conversación MUERA apenas se acepta — "si el usuario pide sería un
 * pedido nuevo". Por eso `pedidoFinalizado` no depende de `now`: es
 * inmediato, no un plazo.
 */

import type { Lead } from "@/core/types";
import { transition } from "@/core/engine/lead-state";

/**
 * ¿Corresponde dar el pedido por finalizado? Solo un pedido (`items`
 * cargado) ya `"pagado"` — una cita confirmada NUNCA pasa por acá (sigue
 * usando `citaCumplida`, con su propio plazo).
 */
export function pedidoFinalizado(lead: Lead): boolean {
  return (
    lead.stage === "datos_completos" &&
    lead.state === "pagado" &&
    (lead.items?.length ?? 0) > 0
  );
}

/**
 * Cierra el pedido: mismo criterio que `cerrarCitaCumplida` — se conserva la
 * identidad (`id`/`contact`/`createdAt`) y el nombre (para saludarlo), se
 * limpia todo lo de ESTE pedido. "recurrente" y no un estado nuevo: ya
 * significa "cliente que ya recibió lo suyo, ofrecerle algo de nuevo" y ya
 * cuenta como cerrado para el seguimiento de ventas.
 */
export function cerrarPedidoFinalizado(lead: Lead, now: Date): Lead {
  return {
    ...lead,
    state: transition(lead.state, "recurrente"),
    stage: "inicio",
    serviceId: undefined,
    items: undefined,
    tentativeDate: undefined,
    entrega: undefined,
    confirmedAt: undefined,
    followUpsSent: [],
    offTopicCount: 0,
    updatedAt: now.toISOString(),
  };
}
