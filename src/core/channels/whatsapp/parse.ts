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
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
}

/** Mensaje de WhatsApp ya extraído y normalizado (sin resolver el negocio). */
export interface ParsedWhatsAppMessage {
  phoneNumberId: string;
  from: string;
  text: string;
  timestamp: string; // ISO 8601
  contactName?: string;
  /**
   * `wamid` de Meta (globalmente único). Sirve para deduplicar un reintento
   * de entrega del webhook (T-05: `MessageDedupeRepository`). Optativo por
   * si algún payload llegara sin `id` — no vale la pena descartar el mensaje
   * por eso, solo se pierde la protección contra duplicados de ESE mensaje.
   */
  messageId?: string;
  /**
   * Presente solo si el mensaje trae una imagen (T-23.1). `text` ya trae el
   * `caption` (o "" si no hay), así que el funnel de texto sigue funcionando
   * sin tocar nada; esto es lo que le hace falta a T-23.5 para pedir la foto.
   */
  image?: { mediaId: string; mimeType: string; caption?: string };
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
        if (!message.from) continue;

        if (message.type === "text" && message.text?.body) {
          result.push({
            phoneNumberId,
            from: message.from,
            text: message.text.body,
            timestamp: toIso(message.timestamp),
            contactName: nameByWaId.get(message.from),
            messageId: message.id,
          });
          continue;
        }

        if (message.type === "image" && message.image?.id) {
          result.push({
            phoneNumberId,
            from: message.from,
            text: message.image.caption ?? "",
            timestamp: toIso(message.timestamp),
            contactName: nameByWaId.get(message.from),
            messageId: message.id,
            image: {
              mediaId: message.image.id,
              mimeType: message.image.mime_type ?? "",
              caption: message.image.caption,
            },
          });
          continue;
        }

        if (message.type && message.type !== "text" && message.type !== "image") {
          // No los procesamos todavía, pero loguear cuáles llegan sirve para
          // saber qué pedir después (T-23.1).
          console.log(`[whatsapp/parse] mensaje descartado, tipo no soportado: ${message.type}`);
        }
      }
    }
  }

  return result;
}
