/**
 * Envío de mensajes por WhatsApp Cloud API (Graph API).
 *
 * Implementa `ChannelAdapter` para que el resto del sistema lo use igual que
 * cualquier otro canal. La construcción de la request se separa en una función
 * pura (`buildSendRequest`) para poder testearla sin red.
 */

import type { Channel, OutgoingMessage } from "@/core/types";
import type { ChannelAdapter } from "@/core/channels/channel";
import type { WhatsAppUsageRepository } from "@/core/storage/whatsapp-usage-repository";

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
  plantilla?: {
    nombre: string;
    idioma: string;
    /**
     * T-31: la plantilla tiene botones de respuesta rápida ("Aprobar" /
     * "Rechazar", en ese orden) cargados en Meta. Si es así, el id de cada
     * botón del mensaje viaja como su payload y vuelve al tocarlo — la dueña
     * aprueba ESE pedido aunque hayan pasado más de 24h.
     */
    conBotones?: boolean;
  };
  /**
   * T-43: a qué negocio se le cuenta cada mensaje que Meta acepta. Se mide
   * acá, en el único punto por donde sale todo (respuestas, avisos a la
   * dueña, "tu pedido está listo"), para no depender de que cada llamador
   * se acuerde de contar.
   */
  medidor?: { negocio: string; repo: WhatsAppUsageRepository };
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
  opts: WhatsAppChannelOptions & { plantilla: NonNullable<WhatsAppChannelOptions["plantilla"]> },
  to: string,
  parametros: string[],
  botones: { id: string }[] = [],
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
        // El título de cada botón es fijo (lo aprobó Meta); lo único que se
        // completa al enviar es el payload, por posición.
        ...(opts.plantilla.conBotones
          ? botones.slice(0, MAX_BOTONES).map((b, index) => ({
              type: "button",
              sub_type: "quick_reply",
              index: String(index),
              parameters: [{ type: "payload", payload: b.id }],
            }))
          : []),
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

/** Límites de Meta para mensajes interactivos con botones de respuesta. */
const MAX_BOTONES = 3;
const MAX_TITULO_BOTON = 20;
const MAX_CUERPO_INTERACTIVO = 1024;

/**
 * T-31: los botones solo se usan si el cuerpo entra en el límite de un
 * mensaje interactivo. Si no entra, Meta rechazaría el mensaje entero; se
 * manda como texto plano, que igual trae la instrucción escrita ("SÍ 12").
 */
function usaBotones(message: OutgoingMessage): boolean {
  return (message.botones?.length ?? 0) > 0 && message.text.length <= MAX_CUERPO_INTERACTIVO;
}

/** Construye la URL y el cuerpo de la petición de envío (texto, o interactivo si trae botones). */
export function buildSendRequest(
  opts: WhatsAppChannelOptions,
  message: OutgoingMessage,
): SendRequest {
  const version = opts.apiVersion ?? "v21.0";
  const url = `https://graph.facebook.com/${version}/${opts.phoneNumberId}/messages`;
  const body = usaBotones(message)
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: message.text },
          action: {
            buttons: message.botones!.slice(0, MAX_BOTONES).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.titulo.slice(0, MAX_TITULO_BOTON) },
            })),
          },
        },
      }
    : {
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
    if (res.ok) {
      await this.medir({ enviados: 1 });
      return;
    }

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
      message.botones,
    );
    const resPlantilla = await fetchImpl(plantilla.url, plantilla.init);
    if (!resPlantilla.ok) {
      const detallePlantilla = await resPlantilla.text().catch(() => "");
      throw new Error(
        `Envío WhatsApp falló (texto y plantilla): ${res.status} ${detail} | ` +
          `${resPlantilla.status} ${detallePlantilla}`,
      );
    }
    await this.medir({ plantillas: 1 });
  }

  /**
   * Nunca lanza: el mensaje ya salió, y si la tabla del medidor no existe
   * (migración 0021 sin aplicar) o la base falla, lanzar haría que quien
   * llama crea que el envío falló y lo reintente — un mensaje duplicado
   * para el cliente por culpa de una métrica.
   */
  private async medir(delta: { enviados?: number; plantillas?: number }): Promise<void> {
    if (!this.opts.medidor) return;
    try {
      await this.opts.medidor.repo.registrar({ negocio: this.opts.medidor.negocio, ...delta });
    } catch (err) {
      console.error("[WhatsApp] no se pudo registrar el uso en uso_whatsapp:", err);
    }
  }
}
