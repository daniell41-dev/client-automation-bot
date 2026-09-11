/**
 * Contrato de idempotencia por mensaje entrante.
 *
 * Meta puede reintentar la entrega de un webhook (red lenta, el handler no
 * respondió a tiempo) mandando el MISMO `message.id` (wamid) más de una vez.
 * Sin esto, un reintento hace que el motor procese el mensaje de nuevo y el
 * cliente reciba la respuesta duplicada. El id de un mensaje de WhatsApp es
 * globalmente único (no depende del negocio), así que este contrato no
 * necesita `businessSlug` como el resto de los repositorios.
 *
 * Una sola operación atómica (`claim`) en vez de "wasProcessed" +
 * "markProcessed" por separado: con dos pasos, dos llamadas concurrentes con
 * el mismo `messageId` podrían leer ambas "no procesado" antes de que
 * ninguna alcance a marcarlo — exactamente la duplicación que esto existe
 * para evitar.
 */

export interface MessageDedupeRepository {
  /**
   * Intenta reclamar este `messageId`. Devuelve `true` la primera vez (hay
   * que procesar el mensaje) y `false` si ya estaba reclamado (es un
   * reintento: no reprocesar). Debe ser atómico frente a llamadas
   * concurrentes con el mismo `messageId`.
   */
  claim(messageId: string): Promise<boolean>;
}
