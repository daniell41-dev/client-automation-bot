/**
 * Parseo del payload entrante de WhatsApp Cloud API.
 *
 * Traduce la estructura anidada de Meta a una forma plana y normalizada. No
 * resuelve el negocio: devuelve el `phoneNumberId` para que el registry lo mapee
 * a un `businessSlug` más arriba en la cadena.
 */

/** Forma mínima del payload de Meta que nos interesa (lo demás se ignora). */
interface MetaPayload {
  entry?: MetaEntry[];
}
interface MetaEntry {
  changes?: MetaChange[];
}
interface MetaChange {
  value?: MetaValue;
}
interface MetaValue {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: MetaMessage[];
}
interface MetaMessage {
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
}

/** Mensaje de WhatsApp ya extraído y normalizado (sin resolver el negocio). */
export interface ParsedWhatsAppMessage {
  phoneNumberId: string;
  from: string;
  text: string;
  timestamp: string; // ISO 8601
  contactName?: string;
}

/** Convierte el timestamp de Meta (segundos unix, string) a ISO 8601. */
function toIso(timestamp: string | undefined): string {
  const seconds = Number.parseInt(timestamp ?? "", 10);
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
}

/**
 * Extrae todos los mensajes de texto de un payload de webhook. Ignora eventos de
 * estado (entregado/leído) y tipos que no sean texto.
 */
export function parseInbound(payload: unknown): ParsedWhatsAppMessage[] {
  const data = (payload ?? {}) as MetaPayload;
  const result: ParsedWhatsAppMessage[] = [];

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const messages = value?.messages;
      if (!phoneNumberId || !messages) continue;

      const nameByWaId = new Map<string, string>();
      for (const contact of value?.contacts ?? []) {
        if (contact.wa_id && contact.profile?.name) {
          nameByWaId.set(contact.wa_id, contact.profile.name);
        }
      }

      for (const message of messages) {
        if (message.type !== "text" || !message.text?.body || !message.from) {
          continue;
        }
        result.push({
          phoneNumberId,
          from: message.from,
          text: message.text.body,
          timestamp: toIso(message.timestamp),
          contactName: nameByWaId.get(message.from),
        });
      }
    }
  }

  return result;
}
