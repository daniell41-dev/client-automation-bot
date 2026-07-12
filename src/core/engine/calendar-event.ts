/**
 * Construye un `CalendarEvent` normalizado a partir de un lead confirmado.
 *
 * Función PURA (sin estado ni I/O): dado el lead, el servicio, el inicio ya
 * resuelto a ISO 8601 y la zona horaria, calcula el evento listo para que el
 * adaptador de calendario lo cree. El fin = inicio + duración del servicio.
 */

import type { CalendarEvent, Lead, Service } from "@/core/types";

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
  const endISO = new Date(startMs + service.durationMinutes * 60_000).toISOString();

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
