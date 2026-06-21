/**
 * Contrato de canal (plataforma de mensajería).
 *
 * El motor produce `OutgoingMessage` normalizados; un `ChannelAdapter` se encarga
 * de entregarlos por la plataforma concreta (WhatsApp hoy, Instagram mañana). La
 * lógica de interpretar el payload entrante vive en cada adaptador (p. ej.
 * `channels/whatsapp/parse.ts`) y produce `IncomingMessage` normalizados.
 */

import type { Channel, OutgoingMessage } from "@/core/types";

export interface ChannelAdapter {
  /** Plataforma que implementa este adaptador. */
  readonly channel: Channel;
  /** Entrega un mensaje saliente por la plataforma. */
  send(message: OutgoingMessage): Promise<void>;
}
