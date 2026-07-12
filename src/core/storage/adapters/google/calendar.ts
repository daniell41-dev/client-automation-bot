/**
 * Acceso a Google Calendar vía Service Account.
 *
 * Espejo de `auth.ts` (Sheets): aísla `googleapis` detrás de una interfaz angosta
 * (`CalendarApi`) con solo la operación que usa el motor (crear evento). Así el
 * flujo se testea inyectando un fake, sin red ni credenciales.
 *
 * Usa las MISMAS credenciales globales de service account (serviceAccountFromEnv),
 * pero pide su propio scope de Calendar. El calendarId es POR NEGOCIO
 * (en BusinessConfig.storage.calendarId).
 *
 * El calendario de cada negocio debe estar compartido con el email de la cuenta
 * de servicio, con permiso para "Hacer cambios en los eventos".
 */

import { google } from "googleapis";
import type { CalendarEvent } from "@/core/types";
import { serviceAccountFromEnv } from "@/core/storage/adapters/google/auth";

/** Operación mínima sobre un calendario que necesita el motor. */
export interface CalendarApi {
  /** Crea un evento y devuelve su id. */
  createEvent(event: CalendarEvent): Promise<{ id: string }>;
}

interface CalendarConfig {
  email: string;
  privateKey: string;
  calendarId: string;
}

/** Implementación real sobre la API de Google Calendar. */
class GoogleCalendarApi implements CalendarApi {
  private readonly calendar;

  constructor(private readonly config: CalendarConfig) {
    const auth = new google.auth.JWT({
      email: config.email,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
    });
    this.calendar = google.calendar({ version: "v3", auth });
  }

  async createEvent(event: CalendarEvent): Promise<{ id: string }> {
    const res = await this.calendar.events.insert({
      calendarId: this.config.calendarId,
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startISO, timeZone: event.timezone },
        end: { dateTime: event.endISO, timeZone: event.timezone },
      },
    });
    return { id: res.data.id ?? "" };
  }
}

/** Cache por calendarId: un cliente por calendario, compartiendo la service account. */
const cache = new Map<string, CalendarApi | null>();

/**
 * Devuelve un cliente de Calendar para el calendario indicado, o `null` si no
 * hay credenciales de service account o no se pasó calendarId.
 *
 * @param calendarId  ID del calendario del negocio (su email o un id de grupo).
 */
export function createCalendarApi(calendarId?: string): CalendarApi | null {
  if (!calendarId) return null;

  if (cache.has(calendarId)) return cache.get(calendarId)!;

  const creds = serviceAccountFromEnv();
  const instance = creds
    ? new GoogleCalendarApi({ ...creds, calendarId })
    : null;
  cache.set(calendarId, instance);
  return instance;
}
