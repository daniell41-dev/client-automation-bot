/**
 * Reinicio de sesión por inactividad (T-20).
 *
 * Dos cosas separadas que conviene no confundir:
 *  - El HILO de conversación (`SessionMemory.history`, cableado en
 *    `handle.ts`) se vacía SIEMPRE a las 24h de inactividad: es contexto de
 *    charla para la IA, y su valor caduca solo con el tiempo, tenga o no el
 *    lead algo pendiente.
 *  - Los DATOS capturados del lead (`limpiarDatosCapturados`) solo se
 *    resetean si quedó a medias (nunca llegó a confirmar) — una cita ya
 *    confirmada (`stage === "datos_completos"`) NUNCA se toca acá: si ya se
 *    cumplió, la cierra `appointment-lifecycle.ts`; si es futura, sigue
 *    vigente sin importar cuánto tiempo pase sin que el cliente escriba.
 */

import type { Lead } from "@/core/types";

/** Umbral de inactividad para arrancar un hilo de conversación nuevo. */
export const INACTIVIDAD_MS = 24 * 60 * 60 * 1000;

/**
 * ¿Pasó más de `ttlMs` desde `lastInboundAt`? Se mide sobre el lead
 * (`Lead.lastInboundAt` existe siempre, con o sin IA) y no sobre
 * `SessionMemory.updatedAt` (que solo existe para negocios con IA, ver
 * `webhook/route.ts`) — así el reinicio funciona igual en los dos casos.
 */
export function inactivo(lastInboundAt: string, now: Date, ttlMs: number = INACTIVIDAD_MS): boolean {
  return now.getTime() - new Date(lastInboundAt).getTime() > ttlMs;
}

/**
 * ¿Conviene borrar lo capturado de este lead tras la inactividad? Solo si
 * quedó a medias (todavía no confirmó): retomar "¿para cuándo?" tres semanas
 * después de que el cliente desapareció no tiene sentido. Una cita ya
 * confirmada nunca se resetea acá.
 */
export function reseteablePorInactividad(lead: Lead): boolean {
  return lead.stage !== "datos_completos";
}

/**
 * Borra lo capturado dejando el lead como recién llegado (mismo
 * id/contacto/createdAt). Es la misma limpieza que ya usaban por separado el
 * comando explícito de reinicio (`responder.ts`) y el "cambié de idea" del
 * agente (`agent.ts`) — un solo lugar para "qué significa empezar de cero"
 * evita que las tres formas de reiniciar (comando, IA, inactividad) diverjan
 * con el tiempo.
 */
export function limpiarDatosCapturados(lead: Lead): void {
  lead.state = "nuevo";
  lead.stage = "inicio";
  lead.name = undefined;
  lead.serviceId = undefined;
  lead.tentativeDate = undefined;
  lead.entrega = undefined;
  lead.notes = undefined;
  lead.offTopicCount = 0;
}
