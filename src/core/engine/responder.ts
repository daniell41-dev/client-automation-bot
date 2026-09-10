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
  ConversationStage,
  IncomingMessage,
  Lead,
  OutgoingMessage,
  Service,
} from "@/core/types";
import { render, type TemplateVars } from "@/core/engine/templating";
import {
  matchService,
  matchRule,
  matchEntrega,
  isGreeting,
  isAffirmative,
  availableServices,
  normalizeDateText,
} from "@/core/engine/intake";
import { transition } from "@/core/engine/lead-state";

export interface RespondResult {
  /** Lead creado o actualizado tras procesar el mensaje. */
  lead: Lead;
  /** Mensajes a enviar al cliente, en orden. */
  messages: OutgoingMessage[];
  /**
   * `true` cuando el motor NO reconoció el mensaje (cayó al fallback, o no
   * matcheó ninguna modalidad de entrega). `handleIncoming` usa esta señal
   * para, si hay IA disponible, intentar traducir el mensaje a una opción
   * real del negocio y volver a correr el motor UNA sola vez (ver
   * `interpretableOptions`). No afecta el comportamiento sin IA.
   */
  unrecognized?: boolean;
}

/** Respuestas rápidas para el paso de confirmación de cita. */
const CONFIRM_OPTIONS = ["Sí, confirmar", "Cambiar fecha"];

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
    entrega: lead.entrega ?? "",
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

/** El menú de opciones = los nombres de los servicios disponibles. */
function menuOptions(config: BusinessConfig): string[] {
  return availableServices(config.services).map((s) => s.name);
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

  /** Une dos fragmentos en un solo mensaje (info del servicio + pregunta). */
  const joinParts = (...parts: string[]) => parts.filter(Boolean).join("\n\n");

  /** Pide confirmar la cita: pasa a `esperando_confirmacion` y devuelve la pregunta. */
  const askConfirmText = (): string => {
    lead.stage = "esperando_confirmacion";
    if (lead.state === "nuevo") lead.state = "interesado";
    return render(config.messages.askConfirm, leadVars(lead, config));
  };

  /**
   * Decide el siguiente paso una vez que ya tenemos el nombre: preguntar la
   * modalidad de entrega (solo si el negocio la activó y aún no la eligió),
   * si no pedir la fecha, si no pasar a confirmación.
   */
  const nextAfterName = (): { text: string; options?: string[] } => {
    if (config.pedidos?.enabled && !lead.entrega) {
      lead.stage = "esperando_entrega";
      return { text: config.pedidos.pregunta, options: config.pedidos.opciones };
    }
    if (!lead.tentativeDate) {
      lead.stage = "esperando_fecha";
      return { text: render(config.messages.askDate, leadVars(lead, config)) };
    }
    return { text: askConfirmText(), options: CONFIRM_OPTIONS };
  };

  // 1) Etapas de captura de datos (tienen prioridad sobre todo lo demás).
  if (lead.stage === "esperando_nombre") {
    lead.name = message.text.trim();
    const next = nextAfterName();
    reply(next.text, next.options);
    return { lead, messages };
  }

  // 1a) Modalidad de entrega (retirar / comer en el local, etc.) — solo
  // existe este stage si el negocio activó `pedidos`.
  if (lead.stage === "esperando_entrega") {
    const opciones = config.pedidos?.opciones ?? [];
    const matched = matchEntrega(message.text, opciones);
    // Sin match: se acepta el texto tal cual (no se le vuelve a preguntar),
    // pero se marca `unrecognized` para que la IA intente mejorarlo a una
    // opción real (ver `interpretableOptions` + `handleIncoming`).
    lead.entrega = matched ?? message.text.trim();
    if (!lead.tentativeDate) {
      lead.stage = "esperando_fecha";
      reply(render(config.messages.askDate, leadVars(lead, config)));
    } else {
      reply(askConfirmText(), CONFIRM_OPTIONS);
    }
    return { lead, messages, unrecognized: !matched };
  }

  if (lead.stage === "esperando_fecha") {
    const fecha = normalizeDateText(message.text);
    // Solo puntuación/muletillas ("???", "no se"): se queda en esperando_fecha
    // y vuelve a preguntar, en vez de agendar una cita sin fecha real.
    if (!fecha) {
      reply(render(config.messages.askDate, leadVars(lead, config)));
      return { lead, messages };
    }
    lead.tentativeDate = fecha;
    reply(askConfirmText(), CONFIRM_OPTIONS);
    return { lead, messages };
  }

  // 1b) Confirmación de la cita: "sí" agenda; cualquier otra cosa re-pregunta la fecha.
  if (lead.stage === "esperando_confirmacion") {
    if (isAffirmative(message.text)) {
      lead.state = transition(lead.state, "agendado");
      lead.stage = "datos_completos";
      reply(render(config.messages.captured, leadVars(lead, config)));
    } else {
      lead.stage = "esperando_fecha";
      reply(render(config.messages.askDate, leadVars(lead, config)));
    }
    return { lead, messages };
  }

  // 2) Selección de servicio (desde inicio, menú, info o datos completos).
  const service = matchService(message.text, config.services);
  if (service) {
    lead.serviceId = service.id;
    if (lead.state === "nuevo") lead.state = "interesado";
    const info = render(config.messages.serviceInfo, serviceVars(service, config));

    // Un solo mensaje: info del servicio + la siguiente pregunta del funnel.
    if (!lead.name) {
      lead.stage = "esperando_nombre";
      reply(joinParts(info, render(config.messages.askName, leadVars(lead, config))));
    } else {
      const next = nextAfterName();
      reply(joinParts(info, next.text), next.options);
    }
    return { lead, messages };
  }

  // 3) Reglas rápidas del negocio (keyword → respuesta exacta). Tienen
  // prioridad sobre el saludo/fallback y sobre la IA; no alteran el funnel.
  const rule = matchRule(message.text, config.ai?.reglas);
  if (rule) {
    reply(rule.respuesta);
    return { lead, messages };
  }

  // 4) Saludo o primer contacto → menú de bienvenida.
  if (lead.stage === "inicio" || isGreeting(message.text)) {
    reply(render(config.messages.welcome, leadVars(lead, config)), menuOptions(config));
    lead.stage = "menu_enviado";
    return { lead, messages };
  }

  // 5) No se entendió → fallback con el menú.
  reply(render(config.messages.fallback, leadVars(lead, config)), menuOptions(config));
  return { lead, messages, unrecognized: true };
}

/**
 * Opciones válidas a las que la IA puede traducir un mensaje no reconocido
 * (ver `RespondResult.unrecognized`). Depende de la etapa en la que estaba
 * el lead ANTES de procesar el mensaje: en `esperando_entrega` son las
 * modalidades de pedido; en cualquier otra, los servicios disponibles (más
 * los accesos rápidos configurados, si el negocio los usa como respuesta).
 */
export function interpretableOptions(
  stage: ConversationStage | undefined,
  config: BusinessConfig,
): string[] {
  if (stage === "esperando_entrega" && config.pedidos?.opciones?.length) {
    return config.pedidos.opciones;
  }
  const servicios = availableServices(config.services).map((s) => s.name);
  const botones = config.ai?.botonesMenu ?? [];
  return Array.from(new Set([...servicios, ...botones]));
}
