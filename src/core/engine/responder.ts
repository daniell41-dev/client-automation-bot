/**
 * Responder: orquesta la conversación.
 *
 * Función pura: dado el lead actual (o `null` si es nuevo), el mensaje entrante
 * y la config del negocio, decide el nuevo estado del lead y los mensajes de
 * salida. No hace I/O: no guarda ni envía nada (de eso se encargan el
 * repositorio y el canal). Esto la hace 100% testeable.
 */

import { randomUUID } from "node:crypto";
import type {
  BusinessConfig,
  IncomingMessage,
  Lead,
  OutgoingMessage,
  Service,
} from "@/core/types";
import { render, type TemplateVars } from "@/core/engine/templating";
import { matchService, isGreeting } from "@/core/engine/intake";

export interface RespondResult {
  /** Lead creado o actualizado tras procesar el mensaje. */
  lead: Lead;
  /** Mensajes a enviar al cliente, en orden. */
  messages: OutgoingMessage[];
}

/** Crea un lead nuevo a partir del primer mensaje. */
function createLead(message: IncomingMessage, now: Date): Lead {
  const iso = now.toISOString();
  return {
    id: randomUUID(),
    businessSlug: message.businessSlug,
    channel: message.channel,
    contact: message.from,
    state: "nuevo",
    stage: "inicio",
    createdAt: iso,
    updatedAt: iso,
    lastInboundAt: message.timestamp,
    followUpsSent: [],
  };
}

/** Formatea un precio según la moneda/locale del negocio. */
function formatPrice(config: BusinessConfig, price: number): string {
  try {
    return new Intl.NumberFormat(config.locale ?? "es-CO", {
      style: "currency",
      currency: config.currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price} ${config.currency}`;
  }
}

/** Variables generales del lead para las plantillas. */
function leadVars(lead: Lead, config: BusinessConfig): TemplateVars {
  const service = config.services.find((s) => s.id === lead.serviceId);
  return {
    nombre: lead.name ?? "",
    servicio: service?.name ?? "",
    fecha: lead.tentativeDate ?? "",
    negocio: config.name,
    agenda: config.bookingUrl ?? "",
  };
}

/** Variables específicas de un servicio para la plantilla de info. */
function serviceVars(service: Service, config: BusinessConfig): TemplateVars {
  return {
    servicio: service.name,
    descripcion: service.description,
    precio: formatPrice(config, service.price),
    duracion: `${service.durationMinutes} minutos`,
    negocio: config.name,
  };
}

/** El menú de opciones = los nombres de los servicios. */
function menuOptions(config: BusinessConfig): string[] {
  return config.services.map((s) => s.name);
}

/**
 * Procesa un mensaje entrante y devuelve el lead actualizado + las respuestas.
 *
 * @param existing Lead actual o `null` si es la primera vez que escribe.
 * @param message  Mensaje entrante normalizado.
 * @param config   Configuración del negocio.
 * @param now      Momento actual (inyectable para tests deterministas).
 */
export function respond(
  existing: Lead | null,
  message: IncomingMessage,
  config: BusinessConfig,
  now: Date = new Date(),
): RespondResult {
  const lead: Lead = existing ? { ...existing } : createLead(message, now);
  lead.lastInboundAt = message.timestamp;
  lead.updatedAt = now.toISOString();

  const messages: OutgoingMessage[] = [];
  const reply = (text: string, options?: string[]) =>
    messages.push({ to: message.from, text, options });

  const finishCapture = () => {
    lead.stage = "datos_completos";
    if (lead.state === "nuevo") lead.state = "interesado";
    reply(render(config.messages.captured, leadVars(lead, config)));
  };

  // 1) Etapas de captura de datos (tienen prioridad sobre todo lo demás).
  if (lead.stage === "esperando_nombre") {
    lead.name = message.text.trim();
    if (!lead.tentativeDate) {
      lead.stage = "esperando_fecha";
      reply(render(config.messages.askDate, leadVars(lead, config)));
    } else {
      finishCapture();
    }
    return { lead, messages };
  }

  if (lead.stage === "esperando_fecha") {
    lead.tentativeDate = message.text.trim();
    finishCapture();
    return { lead, messages };
  }

  // 2) Selección de servicio (desde inicio, menú, info o datos completos).
  const service = matchService(message.text, config.services);
  if (service) {
    lead.serviceId = service.id;
    if (lead.state === "nuevo") lead.state = "interesado";
    reply(render(config.messages.serviceInfo, serviceVars(service, config)));

    if (!lead.name) {
      lead.stage = "esperando_nombre";
      reply(render(config.messages.askName, leadVars(lead, config)));
    } else if (!lead.tentativeDate) {
      lead.stage = "esperando_fecha";
      reply(render(config.messages.askDate, leadVars(lead, config)));
    } else {
      finishCapture();
    }
    return { lead, messages };
  }

  // 3) Saludo o primer contacto → menú de bienvenida.
  if (lead.stage === "inicio" || isGreeting(message.text)) {
    reply(render(config.messages.welcome, leadVars(lead, config)), menuOptions(config));
    lead.stage = "menu_enviado";
    return { lead, messages };
  }

  // 4) No se entendió → fallback con el menú.
  reply(render(config.messages.fallback, leadVars(lead, config)), menuOptions(config));
  return { lead, messages };
}
