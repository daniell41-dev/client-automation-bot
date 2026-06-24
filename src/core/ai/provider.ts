/**
 * Interfaz intercambiable de proveedor LLM.
 * El core depende solo de esta interfaz; el adaptador concreto
 * (Gemini, OpenAI…) lo inyecta la capa de aplicación.
 */

import type { PersonaConfig, ConversationTurn } from "@/core/types";

export interface LLMContext {
  businessName: string;
  persona: PersonaConfig;
  /** Últimos N turnos del historial (user + assistant). */
  history: ConversationTurn[];
  /** Texto de la respuesta ya calculada por el motor (plantilla renderizada). */
  draftResponse: string;
  /** Etapa actual del funnel (para que la IA sepa en qué punto está). */
  stage: string;
}

export interface ILLMProvider {
  /**
   * Recibe el borrador de respuesta del motor y lo reformula con
   * el tono de la persona configurada para el canal.
   * Preserva todos los datos factuales (precios, duraciones, fechas).
   */
  enhance(context: LLMContext): Promise<string>;
}
