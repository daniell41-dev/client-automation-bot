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
  /** T-58: avisos de entrega (sent/delivered/read/failed) de lo que mandó el bot. */
  statuses?: MetaStatus[];
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: MetaMessage[];
}
interface MetaStatus {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
}
interface MetaMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  /** T-46: nota de voz (`voice: true`) o archivo de audio. */
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  /** T-31: respuesta a un botón de un mensaje interactivo. */
  interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
  /** T-31: respuesta rápida de una plantilla (el payload lo define quien la manda). */
  button?: { payload?: string; text?: string };
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
  /**
   * T-46: presente si el mensaje es una nota de voz. `text` llega vacío; lo
   * completa la transcripción en `handle.ts`.
   */
  audio?: { mediaId: string; mimeType: string };
  /** T-31: id del botón tocado (ver `IncomingMessage.botonId`). */
  botonId?: string;
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

        if (message.type === "audio" && message.audio?.id) {
          result.push({
            phoneNumberId,
            from: message.from,
            text: "",
            timestamp: toIso(message.timestamp),
            contactName: nameByWaId.get(message.from),
            messageId: message.id,
            audio: { mediaId: message.audio.id, mimeType: message.audio.mime_type ?? "" },
          });
          continue;
        }

        // T-31: tocar un botón llega como su propio tipo de mensaje. Se
        // normaliza a texto (el título visible) + `botonId`, para que quien no
        // sepa de botones lo siga entendiendo como si se hubiera escrito.
        const boton =
          message.type === "interactive" && message.interactive?.type === "button_reply"
            ? { id: message.interactive.button_reply?.id, texto: message.interactive.button_reply?.title }
            : message.type === "button"
              ? { id: message.button?.payload, texto: message.button?.text }
              : null;
        if (boton) {
          if (boton.id || boton.texto) {
            result.push({
              phoneNumberId,
              from: message.from,
              text: boton.texto ?? "",
              timestamp: toIso(message.timestamp),
              contactName: nameByWaId.get(message.from),
              messageId: message.id,
              botonId: boton.id || undefined,
            });
          }
          continue;
        }

        if (message.type && !["text", "image", "audio"].includes(message.type)) {
          // No los procesamos todavía, pero loguear cuáles llegan sirve para
          // saber qué pedir después (T-23.1).
          console.log(`[whatsapp/parse] mensaje descartado, tipo no soportado: ${message.type}`);
        }
      }
    }
  }

  return result;
}

/** T-58: un mensaje del bot que Meta aceptó pero después no pudo entregar. */
export interface EnvioFallido {
  phoneNumberId: string;
  destinatario: string;
  codigo?: number;
  detalle: string;
}

/**
 * T-58: los envíos que Meta reporta como `failed` en el webhook. Meta acepta
 * el envío (HTTP 200) y recién DESPUÉS avisa que no lo entregó — el caso
 * típico es la ventana de 24h cerrada (131047). Sin leer esto, el aviso a la
 * dueña desaparecía sin ningún rastro en la terminal.
 */
export function parseEnviosFallidos(payload: unknown): EnvioFallido[] {
  const data = (payload ?? {}) as MetaPayload;
  const fallidos: EnvioFallido[] = [];
  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id ?? "";
      for (const st of change.value?.statuses ?? []) {
        if (st.status !== "failed") continue;
        const error = st.errors?.[0];
        fallidos.push({
          phoneNumberId,
          destinatario: st.recipient_id ?? "?",
          codigo: error?.code,
          detalle: error?.error_data?.details ?? error?.message ?? error?.title ?? "sin detalle",
        });
      }
    }
  }
  return fallidos;
}

/** T-58: Meta no entregó porque el destinatario no escribió en las últimas 24h. */
export function esVentanaCerradaEnEstado(codigo: number | undefined): boolean {
  return codigo === 131047 || codigo === 470;
}
