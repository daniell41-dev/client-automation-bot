/**
 * Envío de mensajes por WhatsApp Cloud API (Graph API).
 *
 * Implementa `ChannelAdapter` para que el resto del sistema lo use igual que
 * cualquier otro canal. La construcción de la request se separa en una función
 * pura (`buildSendRequest`) para poder testearla sin red.
 */

import type { Channel, OutgoingMessage } from "@/core/types";
import type { ChannelAdapter } from "@/core/channels/channel";

export interface WhatsAppChannelOptions {
  phoneNumberId: string;
  accessToken: string;
  /** Versión de la Graph API (default v21.0). */
  apiVersion?: string;
  /** Inyectable para tests; por defecto el `fetch` global. */
  fetchImpl?: typeof fetch;
}

export interface SendRequest {
  url: string;
  init: RequestInit;
}

/** Construye la URL y el cuerpo de la petición de envío de un mensaje de texto. */
export function buildSendRequest(
  opts: WhatsAppChannelOptions,
  message: OutgoingMessage,
): SendRequest {
  const version = opts.apiVersion ?? "v21.0";
  const url = `https://graph.facebook.com/${version}/${opts.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: message.to,
    type: "text",
    text: { preview_url: false, body: message.text },
  };
  return {
    url,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  };
}

export class WhatsAppChannel implements ChannelAdapter {
  readonly channel: Channel = "whatsapp";

  constructor(private readonly opts: WhatsAppChannelOptions) {}

  async send(message: OutgoingMessage): Promise<void> {
    const { url, init } = buildSendRequest(this.opts, message);
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const res = await fetchImpl(url, init);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Envío WhatsApp falló: ${res.status} ${detail}`);
    }
  }
}
