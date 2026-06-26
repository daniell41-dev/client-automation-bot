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
  OutgoingMessage,
} from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { SessionRepository } from "@/core/storage/session-repository";
import type { ILLMProvider } from "@/core/ai/provider";
import { respond } from "@/core/engine/responder";

export async function handleIncoming(
  message: IncomingMessage,
  config: BusinessConfig,
  repo: LeadRepository,
  now: Date = new Date(),
  llm?: ILLMProvider,
  sessionRepo?: SessionRepository,
): Promise<OutgoingMessage[]> {
  const existing = await repo.findByContact(message.businessSlug, message.from);
  const { lead, messages } = respond(existing, message, config, now);
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
