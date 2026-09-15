/**
 * Construye un `CalendarEvent` normalizado a partir de un lead confirmado.
 *
 * Función PURA (sin estado ni I/O): dado el lead, el servicio, el inicio ya
 * resuelto a ISO 8601 y la zona horaria, calcula el evento listo para que el
 * adaptador de calendario lo cree. El fin = inicio + duración del servicio.
 */

import type { CalendarEvent, Lead, Service } from "@/core/types";

/** Respaldo cuando un ítem de cita no trae duración — ver el comentario de abajo. */
const DURACION_POR_DEFECTO_MINUTOS = 60;

/**
 * @param lead       Lead confirmado (aporta nombre, contacto y fecha en texto libre).
 * @param service    Servicio elegido (aporta nombre y `durationMinutes`).
 * @param startISO   Inicio ya resuelto a ISO 8601 con offset.
 * @param timezone   Zona horaria IANA del evento (p. ej. "America/Bogota").
 */
export function buildCalendarEvent(
  lead: Lead,
  service: Service,
  startISO: string,
  timezone: string,
): CalendarEvent {
  const startMs = new Date(startISO).getTime();
  // T-21: la duración es opcional (un producto no dura nada). Un ítem que
  // llega hasta acá debería ser de modo cita y traerla, pero si no está se
  // asume una hora en vez de crear un evento de duración cero, que en el
  // calendario se ve como un punto y no como un turno.
  const duracion = service.durationMinutes ?? DURACION_POR_DEFECTO_MINUTOS;
  const endISO = new Date(startMs + duracion * 60_000).toISOString();

  const who = lead.name?.trim() || lead.contact;
  const description = [
    `Cliente: ${who} (${lead.contact})`,
    lead.tentativeDate ? `Pidió: "${lead.tentativeDate}"` : undefined,
    `Canal: ${lead.channel}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary: `${service.name} - ${who}`,
    description,
    startISO,
    endISO,
    timezone,
  };
}
