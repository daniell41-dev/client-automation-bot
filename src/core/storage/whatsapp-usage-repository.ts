/**
 * Medidor de mensajes de WhatsApp por negocio y por mes (T-43).
 *
 * Desde oct-2026 Meta cobra los mensajes pasado un cupo mensual, y las
 * plantillas (el respaldo de T-25 cuando la ventana de 24h está cerrada) se
 * cobran siempre. Sin este conteo no hay forma de saber cuánto le cuesta a la
 * plataforma cada negocio, ni de poner límites a los planes con datos reales.
 *
 * Igual que `AiUsageEntry`: cada entrada es un DELTA a sumar sobre el
 * contador del mes, nunca el total nuevo.
 */
export interface WhatsAppUsageEntry {
  /** UUID de `negocios.id` en Supabase, o el slug en el fallback JSON local. */
  negocio: string;
  /** Mensajes que escribieron los clientes (o la dueña) al número del negocio. */
  recibidos?: number;
  /** Mensajes de formato libre (texto o botones) que Meta aceptó. */
  enviados?: number;
  /** Plantillas aprobadas que Meta aceptó — siempre pagas. */
  plantillas?: number;
}

export interface WhatsAppUsageRepository {
  registrar(entry: WhatsAppUsageEntry): Promise<void>;
}

/**
 * El mes al que se atribuye un mensaje, en hora de Colombia: Meta factura
 * por mes calendario y un mensaje del 31 a las 9 p. m. (ya 1 del mes
 * siguiente en UTC) tiene que caer en el mes en que la dueña lo vio.
 * Formato "AAAA-MM-01", igual que la columna `mes` de la migración 0021.
 */
export function mesDeUso(ahora: Date): string {
  const bogota = new Date(ahora.getTime() - 5 * 60 * 60 * 1000); // UTC-5 todo el año, sin horario de verano
  return `${bogota.toISOString().slice(0, 7)}-01`;
}
