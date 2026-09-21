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
  /**
   * T-25: plantilla aprobada en Meta para reintentar cuando el texto libre se
   * rechaza por ventana de 24h cerrada. Sin esto, el comportamiento es el de
   * siempre: si Meta rechaza, `send` lanza y quien llama decide.
   */
  plantilla?: { nombre: string; idioma: string };
}

export interface SendRequest {
  url: string;
  init: RequestInit;
}

/**
 * Códigos con los que Meta rechaza un mensaje de formato libre porque pasaron
 * más de 24h desde el último mensaje del destinatario (la "ventana de
 * servicio"). Solo ante ESTOS se reintenta con plantilla: un 131026 genérico
 * ("undeliverable") puede ser un número inválido o sin WhatsApp, y ahí la
 * plantilla fallaría igual — reintentar sería gastar una conversación paga
 * para volver a fallar.
 */
const CODIGOS_VENTANA_CERRADA = new Set([131047, 470]);

/** `true` si el cuerpo de error de Meta corresponde a la ventana de 24h cerrada. */
export function esVentanaCerrada(errorBody: string): boolean {
  try {
    const parsed = JSON.parse(errorBody) as {
      error?: { code?: number; error_data?: { details?: string } };
    };
    const code = parsed.error?.code;
    return typeof code === "number" && CODIGOS_VENTANA_CERRADA.has(code);
  } catch {
    // Meta siempre responde JSON en los errores de la Graph API; si llegó otra
    // cosa (proxy, HTML de error), no hay forma de afirmar que sea la ventana.
    return false;
  }
}

/**
 * Los parámetros de una plantilla no admiten saltos de línea, tabs ni más de
 * 4 espacios seguidos — Meta rechaza la plantilla entera con un 132000 si los
 * tienen. El aviso a la dueña es multilínea (resumen del carrito, señales del
 * comprobante), así que se aplana antes de mandarlo como variable.
 */
export function aplanarParametro(texto: string): string {
  return texto.replace(/\s*\n+\s*/g, " · ").replace(/\s{2,}/g, " ").trim();
}

/** Construye la petición de envío de una plantilla aprobada (HSM). */
export function buildTemplateRequest(
  opts: WhatsAppChannelOptions & { plantilla: { nombre: string; idioma: string } },
  to: string,
  parametros: string[],
): SendRequest {
  const version = opts.apiVersion ?? "v21.0";
  const url = `https://graph.facebook.com/${version}/${opts.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: opts.plantilla.nombre,
      language: { code: opts.plantilla.idioma },
      components: [
        {
          type: "body",
          parameters: parametros.map((valor) => ({
            type: "text",
            text: aplanarParametro(valor),
          })),
        },
      ],
    },
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
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const { url, init } = buildSendRequest(this.opts, message);
    const res = await fetchImpl(url, init);
    if (res.ok) return;

    const detail = await res.text().catch(() => "");

    // T-25: el texto libre solo se entrega dentro de la ventana de 24h. Se
    // intenta SIEMPRE primero porque, cuando la ventana está abierta (el caso
    // normal: el cliente acaba de escribir), el mensaje va completo y sin
    // costo de conversación. La plantilla es el respaldo, no el camino
    // principal: es paga, tiene el texto fijo aprobado por Meta y pierde el
    // formato multilínea del aviso.
    const puedeReintentar =
      this.opts.plantilla !== undefined &&
      message.plantillaParams !== undefined &&
      message.plantillaParams.length > 0 &&
      esVentanaCerrada(detail);

    if (!puedeReintentar) {
      throw new Error(`Envío WhatsApp falló: ${res.status} ${detail}`);
    }

    const plantilla = buildTemplateRequest(
      { ...this.opts, plantilla: this.opts.plantilla! },
      message.to,
      message.plantillaParams!,
    );
    const resPlantilla = await fetchImpl(plantilla.url, plantilla.init);
    if (!resPlantilla.ok) {
      const detallePlantilla = await resPlantilla.text().catch(() => "");
      throw new Error(
        `Envío WhatsApp falló (texto y plantilla): ${res.status} ${detail} | ` +
          `${resPlantilla.status} ${detallePlantilla}`,
      );
    }
  }
}
