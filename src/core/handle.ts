/**
 * Orquestación de un mensaje entrante.
 *
 * Ata las tres piezas del core: storage (buscar/guardar el lead) + motor
 * (decidir la respuesta). Es reutilizable por el webhook de WhatsApp y por el
 * simulador offline, así ambos ejecutan exactamente la misma lógica.
 *
 * Dos modos de IA (`config.ai.modo`, default "agente"):
 *   - "agente": la IA decide qué acciones corresponden al turno (elegir
 *     servicio, guardar datos, confirmar, detectar fuera de contexto) — ver
 *     `agent.ts`. Requiere `llm` + `sessionRepo` + una persona configurada
 *     para el canal; si algo falta, o si la IA falla, cae al motor
 *     determinista de siempre para ese mensaje (nunca se rompe la charla).
 *   - "guiado": el funnel de siempre, paso a paso, con la IA solo
 *     reformulando el tono de las plantillas (`enhance`).
 */

import type {
  BusinessConfig,
  IncomingMessage,
  Lead,
  OutgoingMessage,
  SessionMemory,
} from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { SessionRepository } from "@/core/storage/session-repository";
import type { ILLMProvider } from "@/core/ai/provider";
import type { CalendarApi } from "@/core/storage/adapters/google/calendar";
import { interpretableOptions, respond } from "@/core/engine/responder";
import { runAgentTurn } from "@/core/ai/agent";
import { buildCalendarEvent } from "@/core/engine/calendar-event";

const DEFAULT_TIMEZONE = "America/Bogota";

/**
 * Lo mínimo que necesita `handleIncoming` para avisarle a la dueña por
 * WhatsApp. `WhatsAppChannel` ya cumple esta forma (mismo `send`), así que el
 * webhook puede pasar el mismo canal que usa para responderle al cliente.
 */
export interface OwnerNotifier {
  send(message: OutgoingMessage): Promise<void>;
}

/**
 * Resultado de procesar un mensaje. `modo` dice quién redactó la respuesta
 * de verdad: "agente" (la IA decidió las acciones del turno) o "guiado" (el
 * funnel determinista, con o sin `enhance()` encima). `motivoFallback` solo
 * viene con contenido cuando el negocio SÍ tiene el modo agente configurado
 * pero este turno puntual no pudo usarlo — sin esto, un fallback silencioso
 * es indistinguible de un "guiado" configurado a propósito (ver
 * docs/13-modo-agente.md).
 */
export interface HandleResult {
  messages: OutgoingMessage[];
  modo: "agente" | "guiado";
  motivoFallback?: string;
}

export async function handleIncoming(
  message: IncomingMessage,
  config: BusinessConfig,
  repo: LeadRepository,
  now: Date = new Date(),
  llm?: ILLMProvider,
  sessionRepo?: SessionRepository,
  calendar?: CalendarApi,
  notifier?: OwnerNotifier,
): Promise<HandleResult> {
  const existing = await repo.findByContact(message.businessSlug, message.from);

  // Para canales sin persona propia (ej. "mock"), se usa la de whatsapp como fallback.
  const persona = config.personas?.[message.channel] ?? config.personas?.whatsapp;
  const modoAgente = config.ai?.enabled !== false && (config.ai?.modo ?? "agente") === "agente";

  let result: ReturnType<typeof respond> | null = null;
  let usedAgent = false;
  let session: SessionMemory | undefined;
  let motivoFallback: string | undefined;

  if (modoAgente) {
    if (llm && sessionRepo && persona) {
      session = await sessionRepo.getOrCreate(message.businessSlug, message.from, message.channel);
      result = await runAgentTurn(existing, message, config, llm, persona, session.history, now);
      usedAgent = result !== null;
      if (!usedAgent) {
        motivoFallback = "la IA no devolvió un turno válido para este mensaje (ver logs)";
      }
    } else {
      motivoFallback = "faltan requisitos del modo agente (IA, sesión o persona configurada)";
    }
  }

  if (!result) {
    result = respond(existing, message, config, now);
  }

  // Red de seguridad del motor determinista (solo si NO se usó el agente:
  // el agente ya razona con IA, no necesita este segundo intento). El motor
  // no reconoció el mensaje — si hay IA, le pedimos que lo traduzca a una
  // opción real del negocio y corremos el motor de nuevo UNA sola vez con
  // esa traducción — nunca en bucle, y nunca aceptando algo inventado (ver
  // `parseInterpretation`).
  if (!usedAgent && result.unrecognized && llm) {
    const options = interpretableOptions(existing?.stage, config);
    if (options.length > 0) {
      try {
        const interpreted = await llm.interpret({
          text: message.text,
          options,
          stage: existing?.stage ?? "inicio",
          history: [],
        });
        if (interpreted) {
          result = respond(existing, { ...message, text: interpreted }, config, now);
        }
      } catch (err) {
        console.error("[AI] interpret falló, sigue con el fallback:", err);
      }
    }
  }

  const { lead, messages } = result;

  // Side-effects al CONFIRMAR (transición a datos_completos): agendar en el
  // calendario del negocio y avisarle a la dueña por WhatsApp. Se detecta la
  // transición, no el estado, para no repetirlos en mensajes posteriores.
  // Funciona igual para ambos modos: el agente también deja `lead.stage`
  // en "datos_completos" al confirmar (ver `agent.ts`).
  const justConfirmed =
    existing?.stage !== "datos_completos" && lead.stage === "datos_completos";
  if (justConfirmed) {
    if (calendar && llm) {
      await scheduleConfirmedAppointment(lead, config, now, llm, calendar);
    }
    if (notifier && config.notifyPhoneNumber) {
      await notifyOwner(lead, config, notifier);
    }
  }

  await repo.save(lead);

  if (usedAgent) {
    // La respuesta ya la redactó el agente: no se vuelve a reformular con
    // enhance(). Solo se persiste el historial para el contexto del próximo turno.
    if (session && sessionRepo) {
      session.history.push({ role: "user", text: message.text, timestamp: message.timestamp });
      for (const m of messages) {
        session.history.push({ role: "assistant", text: m.text, timestamp: now.toISOString() });
      }
      await sessionRepo.save(session);
    }
    return { messages, modo: "agente" };
  }

  // Modo guiado: con el "cerebro con IA" apagado, o sin persona/sessionRepo,
  // no se reformula (solo plantillas y reglas).
  if (!llm || !sessionRepo || !persona || config.ai?.enabled === false) {
    return { messages, modo: "guiado", motivoFallback };
  }

  const sessionParaEnhance =
    session ?? (await sessionRepo.getOrCreate(message.businessSlug, message.from, message.channel));

  sessionParaEnhance.history.push({
    role: "user",
    text: message.text,
    timestamp: message.timestamp,
  });

  const enhanced: OutgoingMessage[] = [];
  for (const msg of messages) {
    const text = await llm.enhance({
      businessName: config.name,
      persona,
      history: sessionParaEnhance.history,
      draftResponse: msg.text,
      stage: lead.stage,
      knowledge: config.ai?.knowledge,
    });
    enhanced.push({ ...msg, text });
    sessionParaEnhance.history.push({
      role: "assistant",
      text,
      timestamp: now.toISOString(),
    });
  }

  await sessionRepo.save(sessionParaEnhance);
  return { messages: enhanced, modo: "guiado", motivoFallback };
}

/**
 * Crea el evento de calendario para una cita recién confirmada.
 *
 * Resuelve la fecha (texto libre → ISO) con la IA y, si es válida, crea el
 * evento. Si la fecha es ambigua o la creación falla, NO rompe la conversación:
 * deja una nota en el lead (visible en el Sheet) para revisión manual.
 */
async function scheduleConfirmedAppointment(
  lead: Lead,
  config: BusinessConfig,
  now: Date,
  llm: ILLMProvider,
  calendar: CalendarApi,
): Promise<void> {
  const service = config.services.find((s) => s.id === lead.serviceId);
  if (!service || !lead.tentativeDate) return;

  const timezone = config.timezone ?? DEFAULT_TIMEZONE;
  try {
    const startISO = await llm.extractDateTime({
      text: lead.tentativeDate,
      nowISO: now.toISOString(),
      timezone,
    });
    if (!startISO) {
      lead.notes = `Cita sin fecha exacta: "${lead.tentativeDate}". Agendar manualmente.`;
      return;
    }
    const event = buildCalendarEvent(lead, service, startISO, timezone);
    await calendar.createEvent(event);
  } catch (err) {
    console.error("[Calendar] no se pudo agendar la cita:", err);
    lead.notes = `Error al agendar "${lead.tentativeDate}" en el calendario. Revisar manualmente.`;
  }
}

/**
 * Le avisa a la dueña/o por WhatsApp que se confirmó una cita/pedido.
 * No usa IA (mensaje interno, no de cara al cliente); si falla el envío no
 * rompe la conversación con el cliente, solo se registra el error.
 */
async function notifyOwner(
  lead: Lead,
  config: BusinessConfig,
  notifier: OwnerNotifier,
): Promise<void> {
  const service = config.services.find((s) => s.id === lead.serviceId);
  const lines = [
    `🔔 ${config.name}: confirmación nueva`,
    `Cliente: ${lead.name ?? lead.contact}`,
    service ? `${config.pedidos?.enabled ? "Pedido" : "Servicio"}: ${service.name}` : null,
    lead.entrega ? `Modalidad: ${lead.entrega}` : null,
    lead.tentativeDate ? `Fecha/hora: ${lead.tentativeDate}` : null,
  ].filter((line): line is string => Boolean(line));

  try {
    await notifier.send({ to: config.notifyPhoneNumber!, text: lines.join("\n") });
  } catch (err) {
    console.error("[Notify] no se pudo avisar a la dueña por WhatsApp:", err);
  }
}
