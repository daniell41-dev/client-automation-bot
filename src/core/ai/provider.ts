/**
 * Interfaz intercambiable de proveedor LLM.
 * El core depende solo de esta interfaz; el adaptador concreto
 * (Groq, OpenAI…) lo inyecta la capa de aplicación.
 */

import type { ConversationTurn, DiaAtencion, PersonaConfig, QuickRule } from "@/core/types";
import type { AgentResponse } from "@/core/ai/agent-schema";

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

/** Resumen de un servicio del catálogo, tal como se le pasa a la IA en modo agente. */
export interface AgentServiceSummary {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  categoria?: string;
}

/** Lo que el motor ya sabe del cliente antes de este turno. */
export interface AgentLeadState {
  name?: string;
  serviceId?: string;
  tentativeDate?: string;
  entrega?: string;
  /**
   * `true` si la cita/pedido de este cliente YA quedó confirmada. Sin esto,
   * la IA no tiene forma de saberlo y vuelve a pedir datos o a confirmar
   * algo que ya estaba cerrado.
   */
  yaConfirmado: boolean;
  /** Cuántas veces seguidas se salió del tema en esta conversación. */
  offTopicCount: number;
}

/** Contexto completo que necesita la IA para decidir un turno en modo agente. */
export interface AgentTurnInput {
  businessName: string;
  /** Rubro en lenguaje natural (p. ej. "restaurante"), si está configurado. */
  rubro?: string;
  currency: string;
  locale?: string;
  persona: PersonaConfig;
  /** Conocimiento libre del negocio (horarios especiales, políticas, etc.). */
  knowledge?: string;
  /**
   * Reglas rápidas del negocio (keyword → respuesta oficial). En modo guiado
   * tienen prioridad sobre la IA (`matchRule` en `intake.ts`); acá se le
   * pasan como referencia para que no invente una respuesta propia cuando el
   * negocio ya definió la suya.
   */
  reglas?: QuickRule[];
  /** SOLO los servicios disponibles — la IA no debe ofrecer los que no. */
  services: AgentServiceSummary[];
  horarios?: DiaAtencion[];
  /** Presente solo si el negocio activó la modalidad de entrega/pedidos. */
  pedidos?: { pregunta: string; opciones: string[] };
  lead: AgentLeadState;
  /** Historial reciente de la conversación. */
  history: ConversationTurn[];
  /** Mensaje actual del cliente. */
  message: string;
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

  /**
   * Modo agente: la IA decide qué acciones corresponden a este turno (no
   * solo reformula un borrador). Devuelve `null` si la respuesta no es un
   * JSON válido según el contrato — `agent.ts` NUNCA aplica una acción sin
   * antes validarla contra el catálogo/estado real.
   */
  runAgent(input: AgentTurnInput): Promise<AgentResponse | null>;
}
