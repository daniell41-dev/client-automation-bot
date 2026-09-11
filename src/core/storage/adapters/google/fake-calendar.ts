/**
 * Fake en memoria de `CalendarApi` para tests (sin red ni credenciales).
 *
 * Guarda los eventos creados para poder hacer aserciones sobre ellos.
 */

import type { CalendarApi } from "@/core/storage/adapters/google/calendar";
import type { CalendarEvent } from "@/core/types";

export interface FakeCalendar extends CalendarApi {
  /** Eventos creados, en orden. */
  events: CalendarEvent[];
}

export function makeFakeCalendar(): FakeCalendar {
  const events: CalendarEvent[] = [];
  let counter = 0;

  return {
    events,
    async createEvent(event: CalendarEvent): Promise<{ id: string }> {
      events.push(event);
      counter += 1;
      return { id: `evt-${counter}` };
    },
  };
}
