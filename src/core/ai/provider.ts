/**
 * Interfaz intercambiable de proveedor LLM.
 * El core depende solo de esta interfaz; el adaptador concreto
 * (Groq, OpenAI…) lo inyecta la capa de aplicación.
 */

import type { ConversationTurn, PersonaConfig } from "@/core/types";

export interface LLMContext {
  businessName: string;
  persona: PersonaConfig;
  /** Últimos N turnos del historial (user + assistant). */
  history: ConversationTurn[];
  /** Texto de la respuesta ya calculada por el motor (plantilla renderizada). */
  draftResponse: string;
  /** Etapa actual del funnel (para que la IA sepa en qué punto está). */
  stage: string;
  /** Información del negocio (conocimiento configurado en "Respuestas y flujos"). */
  knowledge?: string;
}

/** Entrada para extraer una fecha/hora exacta de texto libre del cliente. */
export interface DateExtractionInput {
  /** Texto libre del cliente (p. ej. "el viernes a las 3"). */
  text: string;
  /** Momento actual en ISO 8601, para resolver fechas relativas ("mañana"). */
  nowISO: string;
  /** Zona horaria IANA del negocio (p. ej. "America/Bogota"). */
  timezone: string;
}

/**
 * Entrada para que la IA traduzca un mensaje que el motor NO reconoció a una
 * de las opciones válidas del negocio (red de seguridad, no un reemplazo del
 * motor: éste sigue siendo quien decide el estado del lead).
 */
export interface InterpretInput {
  /** Texto original del cliente, tal cual lo escribió. */
  text: string;
  /** Opciones válidas entre las que debe elegir (nunca inventar otra). */
  options: string[];
  /** Etapa del funnel en la que se produjo el mensaje (contexto). */
  stage: string;
  /** Historial reciente, si hay (contexto opcional). */
  history: ConversationTurn[];
}

export interface ILLMProvider {
  /**
   * Nombre descriptivo del proveedor/modelo activo (para logs y `pnpm
   * ai:doctor`). Opcional: no todos los proveedores lo necesitan.
   */
  readonly model?: string;

  /**
   * Recibe el borrador de respuesta del motor y lo reformula con
   * el tono de la persona configurada para el canal.
   * Preserva todos los datos factuales (precios, duraciones, fechas).
   */
  enhance(context: LLMContext): Promise<string>;

  /**
   * Extrae una fecha/hora exacta del texto libre del cliente y la devuelve en
   * ISO 8601 con offset (p. ej. "2026-06-30T15:00:00-05:00"), o `null` si es
   * ambigua o no incluye hora. Usado para agendar la cita en el calendario.
   */
  extractDateTime(input: DateExtractionInput): Promise<string | null>;

  /**
   * Traduce un mensaje que el motor NO pudo reconocer a una de las opciones
   * válidas, o `null` si no corresponde a ninguna. Nunca devuelve algo que no
   * esté en `input.options` (se valida contra la lista, no se confía a ciegas
   * en la salida del modelo).
   */
  interpret(input: InterpretInput): Promise<string | null>;
}
