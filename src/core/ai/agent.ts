/**
 * Orquestación del "modo agente": la IA decide QUÉ acciones corresponden al
 * turno (no solo reformula un borrador ya decidido por el motor). Cada
 * acción se VALIDA acá contra el catálogo/estado real antes de aplicarla —
 * la IA nunca escribe el lead directamente, solo propone.
 *
 * Devuelve `null` cuando el agente no pudo procesar el turno (JSON inválido
 * tras la cadena de respaldo, error de red): el llamador (`handleIncoming`)
 * cae al motor determinista para ESE mensaje. El bot nunca se cae por esto.
 */

import type {
  BusinessConfig,
  ConversationStage,
  ConversationTurn,
  IncomingMessage,
  Lead,
  OutgoingMessage,
  PersonaConfig,
} from "@/core/types";
import type { AgentTurnInput, ILLMProvider } from "@/core/ai/provider";
import type { RespondResult } from "@/core/engine/responder";
import {
  ASK_DIRECCION,
  DEFAULT_ASK_CONFIRM_PEDIDO,
  PEDIDO_CONFIRM_OPTIONS,
  createLead,
} from "@/core/engine/responder";
import { render } from "@/core/engine/templating";
import { transition } from "@/core/engine/lead-state";
import {
  availableServices,
  isAffirmative,
  isGreeting,
  isMenuRequest,
  isResetRequest,
  looksLikeDate,
  matchEntrega,
  normalizeDateText,
  parseCantidad,
} from "@/core/engine/intake";
import { DEFAULT_TIMEZONE } from "@/core/timezone";
import { limpiarDatosCapturados } from "@/core/engine/session-lifecycle";
import { modoDelItem } from "@/core/engine/modo-item";
import {
  agregarAlCarrito,
  esDomicilio,
  lineasEntrega,
  pareceDireccion,
  resumenCarrito,
} from "@/core/engine/flows/pedido";

/** Cuántos mensajes SEGUIDOS fuera de tema tolera el bot antes de cerrar la charla. */
const OFF_TOPIC_LIMIT = 3;

/** Mensaje de cierre cuando se llega al límite de mensajes fuera de tema. */
function buildClosingMessage(nombre: string | undefined): string {
  const saludo = nombre ? `${nombre}, ` : "";
  return `${saludo}fue un gusto charlar 😊 Si más adelante te interesa algún servicio, escribime cuando quieras.`;
}

/**
 * Deriva la etapa "visible" del lead a partir de qué datos ya tiene — el
 * modo agente no sigue un guion de etapas fijo, pero el resto del sistema
 * (portal, detección de "recién confirmado" para agendar/avisar) sigue
 * leyendo `lead.stage`, así que se mantiene coherente con los datos reales.
 */
function deriveStage(lead: Lead, config: BusinessConfig): ConversationStage {
  if (!lead.serviceId) return "menu_enviado";
  if (!lead.name) return "esperando_nombre";
  const service = config.services.find((s) => s.id === lead.serviceId);
  // T-21: un ítem de modo "pedido" nunca pasa por entrega/fecha — sin esta
  // rama, `deriveStage` le pedía una fecha para siempre a quien elige un
  // producto (nunca hay `tentativeDate` que llenar en una venta).
  if (service && modoDelItem(service, config.catalogo) === "pedido") {
    return (lead.items?.length ?? 0) > 0 ? "carrito_abierto" : "esperando_cantidad";
  }
  if (config.pedidos?.enabled && !lead.entrega) return "esperando_entrega";
  if (!lead.tentativeDate) return "esperando_fecha";
  return "esperando_confirmacion";
}

function buildAgentInput(
  lead: Lead,
  config: BusinessConfig,
  persona: PersonaConfig,
  history: ConversationTurn[],
  message: string,
  now: Date,
): AgentTurnInput {
  return {
    businessName: config.name,
    rubro: config.rubro,
    currency: config.currency,
    locale: config.locale,
    persona,
    knowledge: config.ai?.knowledge,
    reglas: config.ai?.reglas,
    services: availableServices(config.services).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      durationMinutes: s.durationMinutes,
      categoria: s.categoria,
      modo: modoDelItem(s, config.catalogo),
    })),
    horarios: config.horarios,
    pedidos: config.pedidos?.enabled
      ? { pregunta: config.pedidos.pregunta, opciones: config.pedidos.opciones }
      : undefined,
    lead: {
      name: lead.name,
      serviceId: lead.serviceId,
      tentativeDate: lead.tentativeDate,
      entrega: lead.entrega,
      direccion: lead.direccion,
      yaConfirmado: lead.stage === "datos_completos",
      // T-21/PR5: distinto de `yaConfirmado` — todavía no hay nada resuelto,
      // solo se está esperando el sí/no de la dueña.
      esperandoAprobacion: lead.stage === "esperando_aprobacion",
      offTopicCount: lead.offTopicCount ?? 0,
      // T-21: se resuelve el nombre acá (no en el prompt) para que la IA no
      // tenga que cruzar `servicioId` contra el catálogo ella misma.
      items: lead.items?.map((i) => ({
        servicioId: i.serviceId,
        nombre: config.services.find((s) => s.id === i.serviceId)?.name ?? i.serviceId,
        cantidad: i.cantidad,
      })),
    },
    history,
    message,
    nowISO: now.toISOString(),
    timezone: config.timezone ?? DEFAULT_TIMEZONE,
  };
}

/**
 * T-48: el resumen que el cliente tiene que ver ANTES de que su pedido pase a
 * la dueña — productos, total, entrega y dirección — y la pregunta de
 * confirmación. Lo arma el motor, no la IA: en la primera prueba real el
 * agente se salteó el total y le dijo al cliente que el pedido ya estaba con
 * la dueña sin que el sistema lo hubiera registrado.
 */
function resumenParaConfirmar(lead: Lead, config: BusinessConfig): string {
  return [
    resumenCarrito(lead.items ?? [], config.services, config),
    lineasEntrega(lead.entrega, lead.direccion),
    config.messages.askConfirmPedido ?? DEFAULT_ASK_CONFIRM_PEDIDO,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** T-48: lo próximo que falta para poder cerrar el pedido, en el orden del motor guiado. */
function preguntaQueFaltaPedido(lead: Lead, config: BusinessConfig): string {
  if (!(lead.items?.length ?? 0)) return "¿Qué te gustaría pedir y cuántas unidades?";
  if (config.pedidos?.enabled && !lead.entrega) return config.pedidos.pregunta;
  if (esDomicilio(lead.entrega) && !lead.direccion) return ASK_DIRECCION;
  return render(config.messages.askName, { nombre: "", servicio: "" });
}

/**
 * T-50: la opción de entrega que el cliente nombró textualmente. Más estricta
 * que `matchEntrega` (que también acepta "1"/"2" y palabras sueltas cortas):
 * acá no hay una pregunta pendiente que dé contexto a un número.
 */
function matchEntregaExplicita(texto: string, opciones: string[]): string | undefined {
  const elegida = matchEntrega(texto, opciones);
  return elegida && !/^\s*\d+\s*$/.test(texto) ? elegida : undefined;
}

/** Solo los dígitos, para comparar "300 123 4567" con "3001234567". */
function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

/**
 * T-51: ¿la IA escribió un número de cuenta o de teléfono que el negocio no
 * cargó? En la tercera prueba real inventó "Nequi o Bancolombia al
 * 3123456789". Mandarle plata a un número inventado es el peor error posible
 * de este bot, así que no se confía en el prompt: cualquier secuencia de 7 o
 * más dígitos (sin contar precios con "$") tiene que ser una cuenta real.
 */
export function inventaDatosDePago(texto: string, config: BusinessConfig): boolean {
  const permitidos = new Set(
    [
      ...(config.pagos?.cuentas ?? []).map((c) => c.numero),
      config.pagos?.datosPago?.nequi,
      config.pagos?.telefonoDestino,
    ]
      .filter((n): n is string => Boolean(n))
      .map(soloDigitos),
  );
  const sinPrecios = texto.replace(/\$\s?[\d.,]+/g, "");
  const candidatos = sinPrecios.match(/\d[\d\s.-]{5,}\d/g) ?? [];
  return candidatos
    .map(soloDigitos)
    .filter((d) => d.length >= 7)
    .some((d) => !permitidos.has(d));
}

/** T-48: ¿cambió algo de lo que el cliente ya vio en el resumen? Si cambió, se le vuelve a mostrar. */
function cambioElPedido(antes: Lead | null, ahora: Lead): boolean {
  if (!antes) return true;
  return (
    JSON.stringify(antes.items ?? []) !== JSON.stringify(ahora.items ?? []) ||
    antes.entrega !== ahora.entrega ||
    antes.direccion !== ahora.direccion
  );
}

/**
 * Procesa un mensaje en modo agente. Devuelve `null` si la IA no pudo
 * procesar el turno (para que `handleIncoming` caiga al motor determinista).
 */
export async function runAgentTurn(
  existing: Lead | null,
  message: IncomingMessage,
  config: BusinessConfig,
  llm: ILLMProvider,
  persona: PersonaConfig,
  history: ConversationTurn[],
  now: Date,
): Promise<RespondResult | null> {
  const lead: Lead = existing ? { ...existing } : createLead(message, now);
  lead.lastInboundAt = message.timestamp;
  lead.updatedAt = now.toISOString();

  // "cancelar" / "reiniciar" / "empezar de nuevo": se limpia ANTES de llamar
  // a la IA, así el agente ve un estado en blanco y responde en consecuencia
  // (mismo comportamiento que el motor determinista, sin gastar la decisión
  // en algo que ya es explícito).
  const pidioReinicioExplicito = isResetRequest(message.text);
  if (pidioReinicioExplicito) limpiarDatosCapturados(lead);

  let wasAlreadyConfirmed = !pidioReinicioExplicito && existing?.stage === "datos_completos";
  // T-21/PR5: un pedido ya confirmado por el CLIENTE pero todavía esperando
  // el sí/no de la dueña es sticky igual que `wasAlreadyConfirmed` — sin
  // esto, el siguiente mensaje del cliente re-derivaba el stage y lo hacía
  // volver a "carrito_abierto" como si nunca hubiera confirmado nada.
  let wasAwaitingApproval = !pidioReinicioExplicito && existing?.stage === "esperando_aprobacion";
  const offTopicCountBefore = lead.offTopicCount ?? 0;

  const input = buildAgentInput(lead, config, persona, history, message.text, now);

  let aiResult;
  try {
    aiResult = await llm.runAgent(input);
  } catch (err) {
    const esTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const motivo = esTimeout ? "se agotó el tiempo de espera" : String(err);
    console.error(`[Agent] runAgent falló (${motivo}), cae al motor determinista`);
    return null;
  }
  if (!aiResult) {
    // El proveedor (o toda la cadena de respaldo) no devolvió un JSON válido.
    // El motivo exacto ya se logueó en `openai-compatible.ts`/`resilient.ts`;
    // acá solo se deja constancia de la consecuencia (cae al motor determinista).
    console.error("[Agent] la IA no devolvió un turno válido, cae al motor determinista");
    return null;
  }

  // La IA detectó que los datos guardados no corresponden ("yo no pedí
  // nada", "cambié de idea"). Se limpia ANTES de aplicar el resto de las
  // acciones, para que un `elegir_servicio` del MISMO turno sobreviva.
  if (aiResult.acciones.some((a) => a.tipo === "reiniciar")) {
    limpiarDatosCapturados(lead);
    wasAlreadyConfirmed = false;
    wasAwaitingApproval = false;
  }

  // T-50: la modalidad se aplica ANTES que la dirección aunque la IA las
  // mande al revés — la dirección solo se guarda si ya se sabe que es a
  // domicilio, y en la prueba real se perdían las dos (y con ellas el
  // resumen con el total, que solo aparece con el pedido completo).
  const ORDEN_ACCIONES: Partial<Record<string, number>> = { guardar_modalidad: -1 };
  const acciones = [...aiResult.acciones].sort(
    (a, b) => (ORDEN_ACCIONES[a.tipo] ?? 0) - (ORDEN_ACCIONES[b.tipo] ?? 0),
  );

  let sawOffTopic = false;
  for (const accion of acciones) {
    switch (accion.tipo) {
      case "elegir_servicio": {
        const servicio = availableServices(config.services).find(
          (s) => s.id === accion.servicioId,
        );
        if (servicio) {
          lead.serviceId = servicio.id;
          if (lead.state === "nuevo") lead.state = "interesado";
        }
        break;
      }
      case "guardar_nombre": {
        const nombre = accion.nombre.trim();
        // Defensa extra: aunque la IA se equivoque, un saludo/pedido de
        // menú/reinicio nunca se guarda como si fuera el nombre real.
        const pareceNombreReal =
          nombre.length > 0 &&
          nombre.length <= 80 &&
          !isGreeting(nombre) &&
          !isMenuRequest(nombre) &&
          !isResetRequest(nombre);
        if (pareceNombreReal) lead.name = nombre;
        break;
      }
      case "guardar_modalidad": {
        if (config.pedidos?.enabled) {
          const opciones = config.pedidos.opciones;
          const matched =
            opciones.find((o) => o === accion.modalidad) ??
            matchEntrega(accion.modalidad, opciones);
          if (matched) lead.entrega = matched;
        }
        break;
      }
      case "guardar_direccion": {
        // T-50: dar una dirección ES elegir domicilio. Si la IA no declaró la
        // modalidad, se toma la opción de domicilio del negocio en vez de
        // tirar la dirección y volver a preguntar algo que el cliente ya dijo.
        if (!lead.entrega && config.pedidos?.enabled && pareceDireccion(accion.direccion)) {
          const opcionDomicilio = config.pedidos.opciones.find((o) => esDomicilio(o));
          if (opcionDomicilio) lead.entrega = opcionDomicilio;
        }
        // T-36: solo vale para un pedido a domicilio, y con la misma guarda
        // que el motor guiado — un "ok" no es una dirección.
        if (esDomicilio(lead.entrega) && pareceDireccion(accion.direccion)) {
          lead.direccion = accion.direccion.trim();
        }
        break;
      }
      case "guardar_fecha": {
        // Misma guarda que el motor determinista: solo se guarda si REALMENTE
        // parece una fecha (ver docs/12-comprension-del-cliente.md).
        const fecha = normalizeDateText(accion.fecha);
        if (fecha && looksLikeDate(fecha)) lead.tentativeDate = fecha;
        break;
      }
      case "guardar_cantidad": {
        // T-21: solo se acepta contra un ítem real Y de modo "pedido" — la
        // IA no puede cargarle "cantidad" a algo que se agenda (misma
        // validación contra el catálogo real que el resto de las acciones).
        const servicio = availableServices(config.services).find(
          (s) => s.id === accion.servicioId,
        );
        const cantidad = Math.round(accion.cantidad);
        if (servicio && modoDelItem(servicio, config.catalogo) === "pedido" && cantidad > 0) {
          lead.items = agregarAlCarrito(lead.items, servicio.id, cantidad);
          if (lead.state === "nuevo") lead.state = "interesado";
        }
        break;
      }
      case "fuera_de_contexto":
        sawOffTopic = true;
        break;
      case "reiniciar":
        break; // ya se aplicó arriba, antes del resto de las acciones
      case "confirmar":
        break; // se procesa después de aplicar el resto de las acciones
    }
  }

  // T-51: "dame una bandeja paisa" llegaba como `elegir_servicio` sin
  // `guardar_cantidad`, el carrito quedaba vacío y el pedido nunca se podía
  // cerrar. Un producto que se vende y que el cliente eligió entra al carrito
  // con la cantidad que dijo, o 1: el resumen se la muestra antes de confirmar.
  for (const accion of acciones) {
    if (accion.tipo !== "elegir_servicio") continue;
    const servicio = availableServices(config.services).find((s) => s.id === accion.servicioId);
    if (!servicio || modoDelItem(servicio, config.catalogo) !== "pedido") continue;
    const yaEnCarrito = lead.items?.some((i) => i.serviceId === servicio.id);
    const conCantidad = acciones.some((a) => a.tipo === "guardar_cantidad" && a.servicioId === servicio.id);
    if (!yaEnCarrito && !conCantidad) {
      lead.items = agregarAlCarrito(lead.items, servicio.id, parseCantidad(message.text) ?? 1);
      if (lead.state === "nuevo") lead.state = "interesado";
    }
  }

  // T-50: si el cliente nombró la modalidad ("domicilio por favor") y la IA
  // no la declaró, se toma del mensaje — misma comparación que usa el motor
  // guiado. Solo con un pedido en curso, para no confundir una pregunta suelta.
  if (config.pedidos?.enabled && !lead.entrega && (lead.items?.length ?? 0) > 0) {
    const elegida = matchEntregaExplicita(message.text, config.pedidos.opciones);
    if (elegida) lead.entrega = elegida;
  }

  const hadNewServiceSelection = aiResult.acciones.some((a) => a.tipo === "elegir_servicio");
  if (wasAlreadyConfirmed && hadNewServiceSelection) {
    // Nueva reserva/pedido tras uno ya confirmado (cliente que vuelve a pedir
    // algo más): se conserva el nombre, se limpia lo del anterior — la
    // fecha/carrito viejo no aplican a este ítem nuevo (T-21: "pedir de
    // nuevo" es un pedido NUEVO, no un agregado al ya entregado).
    lead.tentativeDate = undefined;
    lead.entrega = undefined;
    lead.direccion = undefined;
    lead.items = undefined;
  }

  const servicioElegido = config.services.find((s) => s.id === lead.serviceId);
  const esPedido = !!servicioElegido && modoDelItem(servicioElegido, config.catalogo) === "pedido";

  const declaroConfirmar = aiResult.acciones.some((a) => a.tipo === "confirmar");
  const listoParaConfirmar = esPedido
    ? // Un pedido no tiene fecha: alcanza con el nombre y el carrito, más
      // (T-36) la modalidad si el negocio la usa y la dirección si es a
      // domicilio — un pedido a domicilio sin dirección no se puede entregar.
      !!lead.name &&
      (lead.items?.length ?? 0) > 0 &&
      (!config.pedidos?.enabled || !!lead.entrega) &&
      (!esDomicilio(lead.entrega) || !!lead.direccion)
    : !!lead.name &&
      !!lead.serviceId &&
      !!lead.tentativeDate &&
      (!config.pedidos?.enabled || !!lead.entrega);

  // T-48: un pedido solo pasa a la dueña si el cliente dijo que sí DESPUÉS
  // de ver el resumen con el total (el turno anterior quedó en
  // `esperando_confirmacion` y desde entonces no cambió nada). Si la IA
  // declara "confirmar" antes, se muestra el resumen en vez de confirmar.
  const resumenYaVisto =
    !pidioReinicioExplicito && existing?.stage === "esperando_confirmacion" && !cambioElPedido(existing, lead);
  // Un "sí" al resumen confirma aunque la IA se olvide de declararlo: es la
  // respuesta exacta a la pregunta que hizo el motor.
  const confirmarPedido =
    declaroConfirmar || (esPedido && resumenYaVisto && isAffirmative(message.text));
  let mostrarResumen = false;
  let preguntarFaltante = false;

  if (
    esPedido &&
    listoParaConfirmar &&
    !wasAlreadyConfirmed &&
    !wasAwaitingApproval &&
    (!confirmarPedido || !resumenYaVisto)
  ) {
    lead.stage = "esperando_confirmacion";
    // Si ya lo vio y solo preguntó algo, no se le repite el resumen.
    mostrarResumen = !resumenYaVisto;
  } else if (confirmarPedido && listoParaConfirmar && !wasAlreadyConfirmed && !wasAwaitingApproval) {
    if (esPedido) {
      // T-21/PR5: NO pasa a "pagado" todavía — el estado sigue "interesado"
      // hasta que la dueña acepte o rechace (`handle.ts` es quien descuenta
      // el stock y le manda el aviso justo en esta transición).
      lead.stage = "esperando_aprobacion";
    } else {
      lead.state = transition(lead.state, "agendado");
      lead.stage = "datos_completos";
    }
  } else if (wasAlreadyConfirmed && !hadNewServiceSelection) {
    lead.stage = "datos_completos"; // sticky: ya se confirmó, no se re-deriva
  } else if (wasAwaitingApproval) {
    // T-21/PR5: sticky SIN excepción — mientras se espera la respuesta de la
    // dueña, ni un "sí" ni mencionar otro producto cambian nada (mismo
    // criterio que el bloque `esperando_aprobacion` del motor determinista).
    lead.stage = "esperando_aprobacion";
  } else {
    lead.stage = deriveStage(lead, config);
    // T-48: la IA quiso cerrar un pedido al que le falta algo. Su respuesta
    // seguramente dice que ya se lo pasó a la dueña, y no es cierto.
    preguntarFaltante = esPedido && confirmarPedido;
  }

  let respuestaFinal = aiResult.respuesta;
  let opciones: string[] | undefined;
  if (inventaDatosDePago(aiResult.respuesta, config)) {
    console.error("[Agent] la IA escribió un número de cuenta que no está configurado; se descarta su respuesta");
    respuestaFinal = mostrarResumen
      ? resumenParaConfirmar(lead, config)
      : esPedido && !listoParaConfirmar
        ? preguntaQueFaltaPedido(lead, config)
        : "Los datos para pagar te llegan apenas confirmes tu pedido 🙌";
    if (mostrarResumen) opciones = PEDIDO_CONFIRM_OPTIONS;
  } else if (preguntarFaltante) {
    respuestaFinal = preguntaQueFaltaPedido(lead, config);
  } else if (mostrarResumen) {
    // Si la IA creyó que ya cerraba (declaró "confirmar"), su texto promete
    // algo que no pasó: se reemplaza. Si no, se le suma el resumen.
    respuestaFinal = confirmarPedido
      ? resumenParaConfirmar(lead, config)
      : `${aiResult.respuesta}\n\n${resumenParaConfirmar(lead, config)}`;
    opciones = PEDIDO_CONFIRM_OPTIONS;
  }

  // El conteo de "fuera de tema" no aplica una vez que ya se confirmó (ni
  // mientras se espera la respuesta de la dueña, T-21/PR5): una charla
  // informal después de agendar/pedir no debe borrar una cita o un pedido ya
  // en trámite.
  if (lead.stage !== "datos_completos" && lead.stage !== "esperando_aprobacion") {
    if (sawOffTopic) {
      const nuevoCount = offTopicCountBefore + 1;
      if (nuevoCount >= OFF_TOPIC_LIMIT) {
        const nombrePrevio = lead.name;
        limpiarDatosCapturados(lead);
        respuestaFinal = buildClosingMessage(nombrePrevio);
      } else {
        lead.offTopicCount = nuevoCount;
      }
    } else {
      lead.offTopicCount = 0;
    }
  }

  const messages: OutgoingMessage[] = [
    { to: message.from, text: respuestaFinal, ...(opciones ? { options: opciones } : {}) },
  ];
  return { lead, messages };
}
