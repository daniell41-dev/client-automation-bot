/**
 * Orquestación de un mensaje entrante.
 *
 * Ata las tres piezas del core: storage (buscar/guardar el lead) + motor
 * (decidir la respuesta). Es reutilizable por el webhook de WhatsApp y por el
 * simulador offline, así ambos ejecutan exactamente la misma lógica.
 *
 * Modo híbrido de IA: si se inyectan `llm` y `sessionRepo`, cada mensaje del
 * motor pasa por la IA para mejorar el tono sin alterar los datos factuales.
 * Sin esos parámetros el comportamiento es idéntico al original.
 */

import type {
  BusinessConfig,
  IncomingMessage,
  Lead,
  OutgoingMessage,
} from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { SessionRepository } from "@/core/storage/session-repository";
import type { ILLMProvider } from "@/core/ai/provider";
import type { CalendarApi } from "@/core/storage/adapters/google/calendar";
import { respond } from "@/core/engine/responder";
import { buildCalendarEvent } from "@/core/engine/calendar-event";

const DEFAULT_TIMEZONE = "America/Bogota";

export async function handleIncoming(
  message: IncomingMessage,
  config: BusinessConfig,
  repo: LeadRepository,
  now: Date = new Date(),
  llm?: ILLMProvider,
  sessionRepo?: SessionRepository,
  calendar?: CalendarApi,
): Promise<OutgoingMessage[]> {
  const existing = await repo.findByContact(message.businessSlug, message.from);
  const { lead, messages } = respond(existing, message, config, now);

  // Side-effect: al CONFIRMAR la cita (transición a datos_completos) se agenda
  // en el calendario del negocio. Se detecta la transición, no el estado, para
  // no re-crear el evento en mensajes posteriores.
  const justConfirmed =
    existing?.stage !== "datos_completos" && lead.stage === "datos_completos";
  if (justConfirmed && calendar && llm) {
    await scheduleConfirmedAppointment(lead, config, now, llm, calendar);
  }

  await repo.save(lead);

  if (!llm || !sessionRepo || !config.personas) return messages;

  // Para canales sin persona propia (ej. "mock"), se usa la de whatsapp como fallback.
  const persona = config.personas[message.channel] ?? config.personas.whatsapp;
  if (!persona) return messages;

  const session = await sessionRepo.getOrCreate(
    message.businessSlug,
    message.from,
    message.channel,
  );

  session.history.push({
    role: "user",
    text: message.text,
    timestamp: message.timestamp,
  });

  const enhanced: OutgoingMessage[] = [];
  for (const msg of messages) {
    const text = await llm.enhance({
      businessName: config.name,
      persona,
      history: session.history,
      draftResponse: msg.text,
      stage: lead.stage,
    });
    enhanced.push({ ...msg, text });
    session.history.push({
      role: "assistant",
      text,
      timestamp: now.toISOString(),
    });
  }

  await sessionRepo.save(session);
  return enhanced;
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
