/**
 * Canal mock: no envía nada real, solo registra los mensajes "enviados".
 *
 * Sirve para los tests del motor y para el simulador offline (`pnpm sim`), donde
 * queremos ver la conversación sin tokens, sin red y sin webhook público.
 */

import type { Channel, OutgoingMessage } from "@/core/types";
import type { ChannelAdapter } from "@/core/channels/channel";

export class MockChannel implements ChannelAdapter {
  readonly channel: Channel = "mock";

  /** Mensajes que se habrían enviado, en orden, para inspección. */
  readonly sent: OutgoingMessage[] = [];

  async send(message: OutgoingMessage): Promise<void> {
    this.sent.push(message);
  }

  /** Vacía el registro (útil entre escenarios de test). */
  clear(): void {
    this.sent.length = 0;
  }
}
