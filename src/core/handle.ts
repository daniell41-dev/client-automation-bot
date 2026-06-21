/**
 * Orquestación de un mensaje entrante.
 *
 * Ata las tres piezas del core: storage (buscar/guardar el lead) + motor
 * (decidir la respuesta). Es reutilizable por el webhook de WhatsApp y por el
 * simulador offline, así ambos ejecutan exactamente la misma lógica.
 *
 * Nota: el ENVÍO de las respuestas lo hace el llamador con el canal que
 * corresponda (WhatsApp, mock…). Aquí solo se decide y se persiste.
 */

import type {
  BusinessConfig,
  IncomingMessage,
  OutgoingMessage,
} from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import { respond } from "@/core/engine/responder";

export async function handleIncoming(
  message: IncomingMessage,
  config: BusinessConfig,
  repo: LeadRepository,
  now: Date = new Date(),
): Promise<OutgoingMessage[]> {
  const existing = await repo.findByContact(message.businessSlug, message.from);
  const { lead, messages } = respond(existing, message, config, now);
  await repo.save(lead);
  return messages;
}
