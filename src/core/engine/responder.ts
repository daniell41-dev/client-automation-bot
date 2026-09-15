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
  isMenuRequest,
  isResetRequest,
  looksLikeDate,
  availableServices,
  normalizeDateText,
  parseCantidad,
  looksLikeDone,
} from "@/core/engine/intake";
import { transition } from "@/core/engine/lead-state";
import { limpiarDatosCapturados } from "@/core/engine/session-lifecycle";
import { modoDelItem } from "@/core/engine/modo-item";
import { agregarAlCarrito, resumenCarrito } from "@/core/engine/flows/pedido";

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

/**
 * Recordatorio de la cita vigente (T-20) cuando `config.messages.citaVigente`
 * no está configurado. Campo opcional a propósito: hacerlo obligatorio en
 * `MessageTemplates` forzaría a tocar todos los configs y plantillas
 * existentes por un mensaje que la mayoría de los negocios ni necesita editar.
 */
const DEFAULT_CITA_VIGENTE =
  "¡Hola {{nombre}}! Ya tenés agendado {{servicio}} para {{fecha}}. Si necesitás cambiar algo o tenés otra consulta, contame 🙂";

/**
 * Defaults de los mensajes del flujo de pedido (T-21), todos opcionales por
 * el mismo motivo que `DEFAULT_CITA_VIGENTE`: obligarlos en `MessageTemplates`
 * forzaría a tocar todos los configs existentes por un flujo que la mayoría
 * de los negocios (los que agendan) ni usa.
 */
const DEFAULT_ASK_CANTIDAD = "¿Cuántas unidades de {{servicio}} querés, {{nombre}}?";
const DEFAULT_ASK_CONFIRM_PEDIDO = "¿Confirmás tu pedido?";
/**
 * T-21/PR5: entre que el cliente confirma y la dueña acepta/rechaza por
 * WhatsApp, el pedido queda "en revisión" — ya no se confirma directo, ver
 * el bloque `esperando_confirmacion`.
 */
const DEFAULT_ESPERANDO_APROBACION =
  "¡Gracias {{nombre}}! Tu pedido quedó en revisión, en un momento te confirmamos 🙏";
/**
 * Exportado (T-21/PR5): `handle.ts` lo usa para el mensaje al cliente cuando
 * la DUEÑA acepta — ya no se envía desde acá (ver el bloque `esperando_confirmacion`).
 */
export const DEFAULT_PEDIDO_CONFIRMADO =
  "¡Gracias {{nombre}}! Tu pedido quedó confirmado. En breve te contactamos para coordinar la entrega.";
/** Exportado (T-21/PR5): `handle.ts` lo usa cuando la dueña rechaza el pedido. */
export const DEFAULT_PEDIDO_RECHAZADO =
  "Uy {{nombre}}, no pudimos confirmar tu pedido esta vez. Cualquier cosa contame y vemos qué opciones hay 🙏";
const DEFAULT_PEDIDO_VIGENTE =
  "¡Hola {{nombre}}! Ya tenés un pedido confirmado con nosotros. Si querés hacer un pedido nuevo o tenés otra consulta, contame 🙂";

/** Pregunta fija (no configurable, como el resto de la micro-copy de interrupción) tras agregar un producto. */
const ASK_ALGO_MAS = "¿Querés agregar algo más a tu pedido?";
const ALGO_MAS_DONE_OPTION = "No, eso es todo";
const PEDIDO_CONFIRM_OPTIONS = ["Sí, confirmar", "Agregar más"];

/** Crea un lead nuevo a partir del primer mensaje. Exportado: lo reutiliza `agent.ts`. */
export function createLead(message: IncomingMessage, now: Date): Lead {
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
    // T-21: vacío cuando el ítem no tiene duración (un producto). La plantilla
    // `serviceInfo` de un rubro que vende no debería nombrarla; si igual la
    // nombra, sale la etiqueta sin número en vez de "undefined minutos".
    duracion: service.durationMinutes ? `${service.durationMinutes} minutos` : "",
    negocio: config.name,
  };
}

/** El menú de opciones = los nombres de los servicios disponibles. */
function menuOptions(config: BusinessConfig): string[] {
  return availableServices(config.services).map((s) => s.name);
}

/** Menú reducido a los ítems de modo "pedido" (T-21): lo que se ofrece al preguntar "¿algo más?". */
function pedidoMenuOptions(config: BusinessConfig): string[] {
  return availableServices(config.services)
    .filter((s) => modoDelItem(s, config.catalogo) === "pedido")
    .map((s) => s.name);
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

  // Comando de reinicio: en CUALQUIER etapa, "cancelar"/"reiniciar"/"empezar
  // de nuevo" arranca de cero (mismo id/contacto, pero se borra lo
  // capturado). Es la vía de escape si la conversación quedó confusa.
  if (existing && isResetRequest(message.text)) {
    limpiarDatosCapturados(lead);
    lead.stage = "menu_enviado"; // acá sí se manda el menú de una, no queda en "inicio"
    reply(render(config.messages.welcome, leadVars(lead, config)), menuOptions(config));
    return { lead, messages };
  }

  /** Une dos fragmentos en un solo mensaje (info del servicio + pregunta). */
  const joinParts = (...parts: string[]) => parts.filter(Boolean).join("\n\n");

  /**
   * Si el mensaje es una INTERRUPCIÓN (pedido de menú o saludo) en vez de la
   * respuesta a lo que se le preguntó, arma esa respuesta sin tocar el dato
   * pendiente ni la etapa. Es lo que evita que "me repites las opciones?"
   * quede guardado tal cual como si fuera el nombre/la fecha/la
   * confirmación. Devuelve `null` si no es una interrupción reconocida (el
   * llamador sigue con su propia lógica para esa etapa).
   */
  const interruption = (
    pendingText: string,
    pendingOptions?: string[],
  ): { text: string; options?: string[] } | null => {
    if (isMenuRequest(message.text)) {
      const lista = menuOptions(config).join(", ");
      return {
        text: joinParts(`Nuestros servicios: ${lista}.`, pendingText),
        options: pendingOptions,
      };
    }
    if (isGreeting(message.text)) {
      return { text: joinParts("¡Hola de nuevo! 👋", pendingText), options: pendingOptions };
    }
    return null;
  };

  /** Pide confirmar la cita: pasa a `esperando_confirmacion` y devuelve la pregunta. */
  const askConfirmText = (): string => {
    lead.stage = "esperando_confirmacion";
    if (lead.state === "nuevo") lead.state = "interesado";
    return render(config.messages.askConfirm, leadVars(lead, config));
  };

  /**
   * Decide el siguiente paso una vez que ya tenemos el nombre: si el ítem
   * elegido es de modo "pedido" (T-21), pasa directo a pedir cantidad — no
   * tiene sentido preguntarle la modalidad de entrega ni una fecha a quien
   * quiere comprar una harina. Si no, sigue el funnel de siempre: modalidad
   * de entrega (solo si el negocio la activó y aún no la eligió), fecha, y
   * por último confirmación.
   */
  const nextAfterName = (): { text: string; options?: string[] } => {
    const service = config.services.find((s) => s.id === lead.serviceId);
    if (service && modoDelItem(service, config.catalogo) === "pedido") {
      lead.stage = "esperando_cantidad";
      return { text: render(config.messages.askCantidad ?? DEFAULT_ASK_CANTIDAD, leadVars(lead, config)) };
    }
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

  /**
   * Pregunta si el cliente quiere agregar algo más al pedido, mostrando el
   * detalle del carrito hasta ahora. Punto de entrada compartido: se llega
   * acá tanto después de cargar una cantidad como al declinar la
   * confirmación de un pedido (T-21).
   */
  const askAlgoMasText = (): { text: string; options?: string[] } => {
    lead.stage = "carrito_abierto";
    const resumen = resumenCarrito(lead.items ?? [], config.services, config);
    return {
      text: joinParts(resumen, ASK_ALGO_MAS),
      options: [...pedidoMenuOptions(config), ALGO_MAS_DONE_OPTION],
    };
  };

  // 1) Etapas de captura de datos (tienen prioridad sobre todo lo demás).
  if (lead.stage === "esperando_nombre") {
    const pendingText = render(config.messages.askName, leadVars(lead, config));
    const interrupted = interruption(pendingText);
    if (interrupted) {
      reply(interrupted.text, interrupted.options);
      return { lead, messages };
    }
    lead.name = message.text.trim();
    const next = nextAfterName();
    reply(next.text, next.options);
    return { lead, messages };
  }

  // 1a) Modalidad de entrega (retirar / comer en el local, etc.) — solo
  // existe este stage si el negocio activó `pedidos`.
  if (lead.stage === "esperando_entrega") {
    const opciones = config.pedidos?.opciones ?? [];
    const interrupted = interruption(config.pedidos?.pregunta ?? "", opciones);
    if (interrupted) {
      reply(interrupted.text, interrupted.options);
      return { lead, messages };
    }
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

  // 1a-bis) Cantidad de UN producto del pedido (T-21) — alternativa a
  // "esperando_fecha" cuando el ítem elegido no es una cita.
  if (lead.stage === "esperando_cantidad") {
    const pendingText = render(
      config.messages.askCantidad ?? DEFAULT_ASK_CANTIDAD,
      leadVars(lead, config),
    );
    const interrupted = interruption(pendingText);
    if (interrupted) {
      reply(interrupted.text, interrupted.options);
      return { lead, messages };
    }
    if (!lead.serviceId) {
      // No debería pasar (este stage siempre se entra con un ítem elegido),
      // pero sin service no hay a qué sumarle cantidad: se cae al fallback.
      reply(render(config.messages.fallback, leadVars(lead, config)), menuOptions(config));
      return { lead, messages, unrecognized: true };
    }
    const cantidad = parseCantidad(message.text);
    if (!cantidad) {
      reply(pendingText);
      return { lead, messages, unrecognized: true };
    }
    lead.items = agregarAlCarrito(lead.items, lead.serviceId, cantidad);
    if (lead.state === "nuevo") lead.state = "interesado";
    const next = askAlgoMasText();
    reply(next.text, next.options);
    return { lead, messages };
  }

  // 1a-ter) Carrito abierto (T-21): ya hay ≥1 producto cargado, se le
  // preguntó si quiere agregar algo más. Un producto nuevo se suma al
  // carrito; "no"/"eso es todo" pasa a confirmar el pedido completo.
  if (lead.stage === "carrito_abierto") {
    const resumenActual = resumenCarrito(lead.items ?? [], config.services, config);
    const pendingText = joinParts(resumenActual, ASK_ALGO_MAS);
    const opciones = [...pedidoMenuOptions(config), ALGO_MAS_DONE_OPTION];
    const interrupted = interruption(pendingText, opciones);
    if (interrupted) {
      reply(interrupted.text, interrupted.options);
      return { lead, messages };
    }

    const nuevoItem = matchService(message.text, config.services);
    if (nuevoItem && modoDelItem(nuevoItem, config.catalogo) === "pedido") {
      lead.serviceId = nuevoItem.id;
      lead.stage = "esperando_cantidad";
      const info = render(config.messages.serviceInfo, serviceVars(nuevoItem, config));
      const askCantidadText = render(
        config.messages.askCantidad ?? DEFAULT_ASK_CANTIDAD,
        leadVars(lead, config),
      );
      reply(joinParts(info, askCantidadText));
      return { lead, messages };
    }

    if (looksLikeDone(message.text)) {
      lead.stage = "esperando_confirmacion";
      if (lead.state === "nuevo") lead.state = "interesado";
      const askConfirmPedidoText = render(
        config.messages.askConfirmPedido ?? DEFAULT_ASK_CONFIRM_PEDIDO,
        leadVars(lead, config),
      );
      reply(joinParts(resumenActual, askConfirmPedidoText), PEDIDO_CONFIRM_OPTIONS);
      return { lead, messages };
    }

    // Ni un producto reconocido ni una señal de "ya terminé": se repite la
    // pregunta en vez de adivinar.
    reply(pendingText, opciones);
    return { lead, messages, unrecognized: true };
  }

  if (lead.stage === "esperando_fecha") {
    const pendingText = render(config.messages.askDate, leadVars(lead, config));
    const interrupted = interruption(pendingText);
    if (interrupted) {
      reply(interrupted.text, interrupted.options);
      return { lead, messages };
    }
    const fecha = normalizeDateText(message.text);
    // Vacío (solo puntuación/muletillas: "???", "no sé") o no parece
    // hablar de una fecha en absoluto ("me repites las opciones que hay"):
    // se re-pregunta en vez de guardar cualquier cosa como si fuera la fecha.
    if (!fecha || !looksLikeDate(fecha)) {
      reply(pendingText);
      return { lead, messages };
    }
    lead.tentativeDate = fecha;
    reply(askConfirmText(), CONFIRM_OPTIONS);
    return { lead, messages };
  }

  // 1b) Confirmación de la cita, o del pedido (T-21) si el carrito tiene
  // algo cargado — el propio `lead.items` es la señal de cuál de los dos es.
  if (lead.stage === "esperando_confirmacion") {
    const esPedido = (lead.items?.length ?? 0) > 0;
    const resumenPedido = esPedido ? resumenCarrito(lead.items!, config.services, config) : "";
    const pendingText = esPedido
      ? joinParts(
          resumenPedido,
          render(config.messages.askConfirmPedido ?? DEFAULT_ASK_CONFIRM_PEDIDO, leadVars(lead, config)),
        )
      : render(config.messages.askConfirm, leadVars(lead, config));
    const opciones = esPedido ? PEDIDO_CONFIRM_OPTIONS : CONFIRM_OPTIONS;
    const interrupted = interruption(pendingText, opciones);
    if (interrupted) {
      reply(interrupted.text, interrupted.options);
      return { lead, messages };
    }

    if (isAffirmative(message.text)) {
      if (esPedido) {
        // T-21/PR5: NO pasa a "pagado" todavía — queda en revisión hasta que
        // la dueña acepte o rechace por WhatsApp (ver `handle.ts`, que es
        // quien descuenta el stock y le manda el aviso en este mismo punto).
        // El estado sigue "interesado": recién se mueve a "pagado"/"perdido"
        // cuando la dueña responde.
        lead.stage = "esperando_aprobacion";
        reply(
          joinParts(
            resumenPedido,
            render(config.messages.esperandoAprobacion ?? DEFAULT_ESPERANDO_APROBACION, leadVars(lead, config)),
          ),
        );
        return { lead, messages };
      }
      lead.state = transition(lead.state, "agendado");
      lead.stage = "datos_completos";
      reply(render(config.messages.captured, leadVars(lead, config)));
      return { lead, messages };
    }

    if (esPedido) {
      // No tiene sentido "pedir una fecha nueva" para un pedido: vuelve al
      // carrito para seguir agregando o revisando lo que ya cargó.
      const next = askAlgoMasText();
      reply(next.text, next.options);
      return { lead, messages };
    }

    // ¿Trajo una fecha nueva directamente ("mejor el sábado")? Se actualiza
    // sin volver a pedirla por separado.
    const nuevaFecha = normalizeDateText(message.text);
    if (nuevaFecha && looksLikeDate(nuevaFecha)) {
      lead.tentativeDate = nuevaFecha;
      reply(askConfirmText(), CONFIRM_OPTIONS);
      return { lead, messages };
    }

    // Genuinamente ambiguo ("no", "cambiar fecha"): se vuelve a pedir.
    lead.stage = "esperando_fecha";
    reply(render(config.messages.askDate, leadVars(lead, config)));
    return { lead, messages };
  }

  // 1b-bis) Pedido en revisión (T-21/PR5): ya se avisó a la dueña por
  // WhatsApp y se espera su sí/no — no hay nada que el cliente pueda hacer
  // acá salvo esperar (o "cancelar", que ya se maneja arriba de todo el
  // funnel). Siempre la misma respuesta, sin importar qué escriba.
  if (lead.stage === "esperando_aprobacion") {
    reply(render(config.messages.esperandoAprobacion ?? DEFAULT_ESPERANDO_APROBACION, leadVars(lead, config)));
    return { lead, messages };
  }

  // 1c) Ya se confirmó una cita (o se aceptó un pedido) y no hay ningún dato
  // pendiente que capturar. Bloque propio ANTES de la selección de servicio
  // (2) y del saludo (4): sin esto, un "Hola" caía en el saludo genérico y
  // bajaba el stage a "menu_enviado" perdiendo la cita/pedido ya hecho; y
  // elegir OTRO ítem arrastraba la fecha/modalidad/carrito anterior porque
  // `nextAfterName` las encontraba ya cargadas y saltaba directo a confirmar
  // con ellas.
  if (lead.stage === "datos_completos") {
    const nuevoServicio = matchService(message.text, config.services);
    if (nuevoServicio) {
      // Reserva/pedido nuevo sobre uno ya confirmado: se conserva el nombre,
      // se limpia lo que era del anterior (no aplica a este ítem) y se pide
      // de nuevo lo que falte. Mismo criterio que ya usa el modo agente
      // (`agent.ts`) ante esta misma situación.
      lead.serviceId = nuevoServicio.id;
      lead.tentativeDate = undefined;
      lead.entrega = undefined;
      lead.appointmentAt = undefined;
      // T-21: "pedir de nuevo" es un PEDIDO NUEVO, no un agregado al que ya
      // se entregó — el carrito viejo no debe colarse en este.
      lead.items = undefined;
      const info = render(config.messages.serviceInfo, serviceVars(nuevoServicio, config));
      const next = nextAfterName();
      reply(joinParts(info, next.text), next.options);
      return { lead, messages };
    }

    const rule = matchRule(message.text, config.ai?.reglas);
    if (rule) {
      reply(rule.respuesta);
      return { lead, messages };
    }

    // Saludo o cualquier otra cosa: se recuerda la cita/pedido vigente sin
    // bajar el stage ni re-mandar el menú.
    const fueUnPedido = (lead.items?.length ?? 0) > 0;
    reply(
      render(
        fueUnPedido
          ? config.messages.pedidoVigente ?? DEFAULT_PEDIDO_VIGENTE
          : config.messages.citaVigente ?? DEFAULT_CITA_VIGENTE,
        leadVars(lead, config),
      ),
    );
    return { lead, messages };
  }

  // 2) Selección de servicio (desde inicio, menú o info).
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
