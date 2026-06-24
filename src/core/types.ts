/**
 * Tipos normalizados del core.
 *
 * Estos tipos son la "lengua franca" del sistema: el motor (engine) solo habla
 * en términos de estos tipos, sin saber nada de WhatsApp, de Next.js ni de un
 * negocio concreto. Los adaptadores de canal y de almacenamiento son los únicos
 * que traducen entre estos tipos y el mundo exterior.
 *
 * Reglas: este archivo no importa nada de `next/*` ni del SDK de Meta.
 */

/** Estado comercial de un lead a lo largo del embudo de ventas. */
export type LeadState =
  | "nuevo"
  | "interesado"
  | "agendado"
  | "pagado"
  | "perdido"
  | "recurrente";

/** En qué punto de la conversación está el lead (controla qué se le pide después). */
export type ConversationStage =
  | "inicio" // todavía no se le ha mostrado el menú
  | "menu_enviado" // se mostró el menú, esperando que elija servicio
  | "info_enviada" // se dio info del servicio, esperando que pida datos/agendar
  | "esperando_nombre" // se le pidió el nombre
  | "esperando_fecha" // se le pidió la fecha tentativa
  | "datos_completos"; // ya tenemos nombre + servicio + fecha

/** Plataforma por la que llega/sale un mensaje. */
export type Channel = "whatsapp" | "instagram" | "mock";

/** Persona (tono/voz) que usa el bot en un canal concreto. */
export interface PersonaConfig {
  /** Nombre del bot (p. ej. "Isabella"). */
  name: string;
  /** Descripción del tono para el prompt de IA (en inglés o español). */
  tone: string;
  /** Idioma / variedad (p. ej. "español colombiano informal"). */
  language: string;
}

/** Umbrales de seguimiento soportados en el MVP. */
export type FollowUpThreshold = "2h" | "1d" | "3d";

/** Un servicio que ofrece el negocio (lo personaliza cada `BusinessConfig`). */
export interface Service {
  /** Identificador estable (p. ej. "limpieza-facial"). */
  id: string;
  /** Nombre visible (p. ej. "Limpieza facial profunda"). */
  name: string;
  /** Descripción que se envía cuando el cliente pide info. */
  description: string;
  /** Precio en la moneda de la config. */
  price: number;
  /** Duración del servicio en minutos. */
  durationMinutes: number;
  /** Palabras clave para detectar el servicio en texto libre del cliente. */
  keywords?: string[];
}

/** Configuración de un seguimiento (cuándo y con qué mensaje). */
export interface FollowUpConfig {
  threshold: FollowUpThreshold;
  /** Minutos desde el último mensaje del cliente tras los cuales aplica. */
  afterMinutes: number;
  /** Plantilla del mensaje de seguimiento (admite variables `{{...}}`). */
  message: string;
}

/** Plantillas de mensajes del negocio. Admiten variables `{{nombre}}`, etc. */
export interface MessageTemplates {
  /** Saludo inicial + invitación a elegir un servicio. */
  welcome: string;
  /** Pedir el nombre del cliente. */
  askName: string;
  /** Pedir la fecha tentativa. */
  askDate: string;
  /** Info de un servicio. Variables: {{servicio}} {{descripcion}} {{precio}} {{duracion}}. */
  serviceInfo: string;
  /** Confirmación tras capturar todos los datos. Variables: {{nombre}} {{servicio}} {{fecha}}. */
  captured: string;
  /** Respuesta cuando no se entendió el mensaje. */
  fallback: string;
}

/**
 * Toda la personalización de un negocio. Es SOLO datos: el comportamiento lo
 * pone el motor genérico. Para un negocio nuevo se crea uno de estos sin tocar
 * `core/`.
 */
export interface BusinessConfig {
  /** Identificador en kebab-case (p. ej. "estetica-bella"). */
  slug: string;
  /** Nombre comercial del negocio. */
  name: string;
  /** Código de moneda (p. ej. "COP"). */
  currency: string;
  /** Locale para formatear precios (p. ej. "es-CO"). */
  locale?: string;
  /** Catálogo de servicios. */
  services: Service[];
  /** Plantillas de mensajes. */
  messages: MessageTemplates;
  /** Configuración de seguimientos (2h / 1d / 3d). */
  followUps: FollowUpConfig[];
  /** Link de agenda opcional (Calendly, Google Calendar…). */
  bookingUrl?: string;
  /** Persona del bot por canal. Si un canal no está, se omite la IA para ese canal. */
  personas?: Partial<Record<Channel, PersonaConfig>>;
}

/** Mensaje entrante ya normalizado (independiente de la plataforma). */
export interface IncomingMessage {
  channel: Channel;
  /** Negocio ya resuelto (por el registry) a partir del identificador de plataforma. */
  businessSlug: string;
  /** Identificador del contacto (número de teléfono / id de la plataforma). */
  from: string;
  /** Texto del mensaje del cliente. */
  text: string;
  /** Marca de tiempo ISO 8601 del mensaje. */
  timestamp: string;
  /** Nombre de perfil del contacto, si la plataforma lo provee. */
  contactName?: string;
}

/** Mensaje saliente normalizado que un canal debe entregar. */
export interface OutgoingMessage {
  /** Destinatario (mismo identificador que `IncomingMessage.from`). */
  to: string;
  /** Texto a enviar. */
  text: string;
  /** Opciones de menú / respuestas rápidas, si aplica. */
  options?: string[];
}

/** Un interesado registrado por el sistema. */
export interface Lead {
  id: string;
  businessSlug: string;
  channel: Channel;
  /** Identificador del contacto (teléfono / id). */
  contact: string;
  name?: string;
  /** Servicio de interés (`Service.id`). */
  serviceId?: string;
  /** Fecha tentativa indicada por el cliente (texto libre). */
  tentativeDate?: string;
  state: LeadState;
  stage: ConversationStage;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
  /** ISO 8601 del último mensaje entrante del cliente (base para seguimientos). */
  lastInboundAt: string;
  /** Umbrales de seguimiento ya enviados (para no repetir). */
  followUpsSent: FollowUpThreshold[];
  notes?: string;
}

/** Un turno en el historial de conversación (para memoria de sesión). */
export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

/** Memoria de sesión de un contacto (historial de los últimos N mensajes). */
export interface SessionMemory {
  contact: string;
  businessSlug: string;
  channel: Channel;
  history: ConversationTurn[];
  updatedAt: string;
}

/** Un seguimiento pendiente calculado por el motor (el envío real es fase 2). */
export interface FollowUp {
  leadId: string;
  contact: string;
  businessSlug: string;
  threshold: FollowUpThreshold;
  /** Mensaje ya renderizado, listo para enviar. */
  message: string;
  /** Cuándo correspondía enviarlo (ISO 8601). */
  dueAt: string;
}
