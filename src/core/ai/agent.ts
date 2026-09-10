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
import { createLead } from "@/core/engine/responder";
import { transition } from "@/core/engine/lead-state";
import {
  availableServices,
  isGreeting,
  isMenuRequest,
  isResetRequest,
  looksLikeDate,
  matchEntrega,
  normalizeDateText,
} from "@/core/engine/intake";

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
): AgentTurnInput {
  return {
    businessName: config.name,
    rubro: config.rubro,
    currency: config.currency,
    locale: config.locale,
    persona,
    knowledge: config.ai?.knowledge,
    services: availableServices(config.services).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      durationMinutes: s.durationMinutes,
      categoria: s.categoria,
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
      offTopicCount: lead.offTopicCount ?? 0,
    },
    history,
    message,
  };
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

  const wasAlreadyConfirmed = existing?.stage === "datos_completos";
  const offTopicCountBefore = lead.offTopicCount ?? 0;

  const input = buildAgentInput(lead, config, persona, history, message.text);

  let aiResult;
  try {
    aiResult = await llm.runAgent(input);
  } catch (err) {
    console.error("[Agent] runAgent falló, cae al motor determinista:", err);
    return null;
  }
  if (!aiResult) return null;

  let sawOffTopic = false;
  for (const accion of aiResult.acciones) {
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
      case "guardar_fecha": {
        // Misma guarda que el motor determinista: solo se guarda si REALMENTE
        // parece una fecha (ver docs/12-comprension-del-cliente.md).
        const fecha = normalizeDateText(accion.fecha);
        if (fecha && looksLikeDate(fecha)) lead.tentativeDate = fecha;
        break;
      }
      case "fuera_de_contexto":
        sawOffTopic = true;
        break;
      case "confirmar":
        break; // se procesa después de aplicar el resto de las acciones
    }
  }

  const hadNewServiceSelection = aiResult.acciones.some((a) => a.tipo === "elegir_servicio");
  if (wasAlreadyConfirmed && hadNewServiceSelection) {
    // Nueva reserva tras una ya confirmada (cliente que vuelve a pedir algo
    // más): se conserva el nombre, se piden de nuevo fecha/modalidad para
    // este servicio nuevo — la fecha anterior ya no aplica.
    lead.tentativeDate = undefined;
    lead.entrega = undefined;
  }

  const confirmarPedido = aiResult.acciones.some((a) => a.tipo === "confirmar");
  const listoParaConfirmar =
    !!lead.name &&
    !!lead.serviceId &&
    !!lead.tentativeDate &&
    (!config.pedidos?.enabled || !!lead.entrega);

  if (confirmarPedido && listoParaConfirmar && !wasAlreadyConfirmed) {
    lead.state = transition(lead.state, "agendado");
    lead.stage = "datos_completos";
  } else if (wasAlreadyConfirmed && !hadNewServiceSelection) {
    lead.stage = "datos_completos"; // sticky: ya se confirmó, no se re-deriva
  } else {
    lead.stage = deriveStage(lead, config);
  }

  let respuestaFinal = aiResult.respuesta;

  // El conteo de "fuera de tema" no aplica una vez que ya se confirmó: una
  // charla informal DESPUÉS de agendar no debe borrar una cita ya hecha.
  if (lead.stage !== "datos_completos") {
    if (sawOffTopic) {
      const nuevoCount = offTopicCountBefore + 1;
      if (nuevoCount >= OFF_TOPIC_LIMIT) {
        const nombrePrevio = lead.name;
        lead.state = "nuevo";
        lead.stage = "inicio";
        lead.name = undefined;
        lead.serviceId = undefined;
        lead.tentativeDate = undefined;
        lead.entrega = undefined;
        lead.offTopicCount = 0;
        respuestaFinal = buildClosingMessage(nombrePrevio);
      } else {
        lead.offTopicCount = nuevoCount;
      }
    } else {
      lead.offTopicCount = 0;
    }
  }

  const messages: OutgoingMessage[] = [{ to: message.from, text: respuestaFinal }];
  return { lead, messages };
}
