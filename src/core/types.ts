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
  | "esperando_confirmacion" // se le pidió confirmar la cita (Sí/cambiar fecha)
  | "esperando_entrega" // se le preguntó la modalidad (retirar / comer en el local)
  | "esperando_cantidad" // T-21: se le preguntó cuánto quiere de UN producto del carrito
  | "carrito_abierto" // T-21: tiene ≥1 producto cargado, se le preguntó si quiere algo más
  | "esperando_aprobacion" // T-21/PR5: el cliente confirmó el pedido, se le avisó a la dueña por WhatsApp y se espera su sí/no
  | "datos_completos"; // ya tenemos lo necesario (cita agendada, o pedido aceptado por la dueña)

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

/**
 * Qué persigue el bot cuando el cliente elige este ítem (T-21).
 *
 * El camino es del ÍTEM, no del negocio: un taller mecánico agenda el service
 * y vende el repuesto en la misma conversación, así que un enum por negocio
 * no alcanzaría. Ver `core/engine/modo-item.ts`.
 */
export type ModoItem = "cita" | "pedido";

/** Un ítem del carrito de un pedido (T-21): qué producto y cuántas unidades. */
export interface CartItem {
  /** `Service.id` del producto. */
  serviceId: string;
  cantidad: number;
}

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
  /**
   * Duración en minutos. Opcional desde T-21: una harina no dura nada. Solo
   * tiene sentido (y es obligatoria) en los ítems de modo "cita", que son los
   * únicos que ocupan un tramo de agenda y crean un evento de calendario.
   */
  durationMinutes?: number;
  /** Palabras clave para detectar el servicio en texto libre del cliente. */
  keywords?: string[];
  /** Categoría visible en el catálogo (p. ej. "Entradas", "Faciales"). */
  categoria?: string;
  /** Si es `false`, el bot no lo ofrece en el menú ni lo reconoce. Default `true`. */
  disponible?: boolean;
  /** Si es `true`, aparece en "Servicios reservables" (citas/turnos). */
  reservable?: boolean;
  /**
   * Fuerza el camino de este ítem (T-21). Sin declarar, se deduce de
   * `reservable` y del rubro — ver `modoDelItem`.
   */
  modo?: ModoItem;
  /**
   * Unidades disponibles, para los ítems que se venden. Es solo el valor que
   * el dueño carga a mano en el portal; el descuento por venta vive aparte
   * (ver el PR de inventario), porque este config se reescribe entero en cada
   * guardado y dos ventas simultáneas se pisarían.
   */
  stock?: number;
}

/**
 * Cómo es el catálogo de un rubro (T-21): con qué palabra se nombra un ítem,
 * qué camino siguen los ítems que no lo declaran, y qué campos tiene sentido
 * mostrarle al dueño.
 *
 * Vive en la plantilla del rubro y se copia al negocio al crearlo. Es lo que
 * antes se adivinaba con una regex sobre el NOMBRE del rubro
 * (`components/rubro-visual.tsx`): si el rubro se llamaba "Kiosco" en vez de
 * "Tienda", el producto terminaba ofreciéndose como turno.
 *
 * Todo opcional a propósito: un negocio sin este bloque se comporta igual que
 * antes de T-21.
 */
export interface CatalogoConfig {
  /** Cómo se llama un ítem en este rubro: "Servicio", "Producto", "Plato", "Repuesto". */
  etiqueta?: { singular: string; plural: string };
  /** Camino de los ítems que no declaran `modo` ni `reservable`. Default "cita". */
  modoPorDefecto?: ModoItem;
  /** Qué campos del ítem tiene sentido editar en este rubro. */
  campos?: {
    duracion?: boolean;
    stock?: boolean;
    categoria?: boolean;
  };
}

/** Una regla rápida del bot: si el mensaje contiene una keyword, responde exacto. */
export interface QuickRule {
  /** Palabras clave que disparan la regla (se comparan normalizadas). */
  keywords: string[];
  /** Respuesta exacta que envía el bot. Tiene prioridad sobre la IA. */
  respuesta: string;
}

/** Configuración del "cerebro" del bot: IA + reglas + fallback. */
export interface BotAIConfig {
  /** Si es `false`, no se reformula con IA (solo plantillas y reglas). */
  enabled: boolean;
  /**
   * "agente" (default): la IA decide qué hacer en cada turno (elegir
   * servicio, guardar datos, responder preguntas con criterio, detectar si
   * el cliente se salió del tema) — el motor determinista queda como red de
   * seguridad si la IA falla. "guiado": el funnel de siempre, paso a paso,
   * con la IA solo reformulando el tono. Requiere `enabled: true` y una
   * `persona` configurada para el canal; si falta algo de eso, se usa
   * "guiado" igual.
   */
  modo?: "agente" | "guiado";
  /** Información del negocio con la que responde la IA (conocimiento). */
  knowledge?: string;
  /** Reglas rápidas keyword → respuesta. Tienen prioridad sobre la IA. */
  reglas?: QuickRule[];
  /** Accesos rápidos que se muestran como botones de menú en el chat. */
  botonesMenu?: string[];
  /** Si el bot no entiende, ¿derivar a una persona? */
  derivarHumano?: boolean;
}

/**
 * Modalidad de entrega/consumo para negocios que no son de "cita en otro día"
 * (p. ej. un restaurante: retirar en el local vs comer ahí). Opcional: si no
 * está `enabled`, el funnel no pregunta nada de esto (comportamiento actual).
 */
export interface PedidosConfig {
  enabled: boolean;
  /** Pregunta que hace el bot (p. ej. "¿Retirás en el local o comés acá?"). */
  pregunta: string;
  /** Opciones de modalidad (2 a 4), p. ej. ["Retirar en el local", "Comer en el restaurante"]. */
  opciones: string[];
}

/**
 * Confirmación de pago (T-24.4, Nivel 1 — triaje asistido, `docs/15-plan-vision-tienda.md` §1.6).
 * Sin esto (default), el flujo sigue igual que antes de T-24: la dueña
 * aprueba el pedido con un SÍ/NO plano, sin comprobante de por medio.
 */
export interface PagosConfig {
  /**
   * Si es `true`, al confirmar el pedido el bot NO le avisa a la dueña
   * todavía — le pide al cliente que pague y mande la foto del comprobante.
   * Recién cuando llega la foto se le avisa a la dueña (con los datos leídos
   * + las señales de riesgo) para que apruebe o rechace.
   */
  requiereComprobante?: boolean;
  /**
   * Cuenta/teléfono real que el negocio usa para cobrar (Nequi, Bancolombia,
   * Pago Móvil...) — para la señal "destino no coincide" de `señales-pago.ts`.
   */
  telefonoDestino?: string;
}

/** Un tramo horario dentro de un día, "HH:MM" 24hs. */
export interface HourRange {
  /** Hora de apertura "HH:MM". */
  desde: string;
  /** Hora de cierre "HH:MM". */
  hasta: string;
}

/**
 * Horario de atención de UN día de la semana (T-20).
 *
 * `dow` (day of week) numérico y no un nombre de día en texto libre — es lo
 * que permite validar una cita por código (`core/engine/horarios.ts`) sin
 * tener que normalizar tildes/mayúsculas/abreviaturas contra algo como
 * "Lunes a viernes". Mismo criterio que `Date.getDay()`: 0 = domingo,
 * 6 = sábado.
 *
 * `tramos` admite más de uno para el corte de mediodía (9-13 y 15-19): sin
 * eso, un negocio así tendría que declarar un solo tramo 9-19 y el bot
 * aceptaría citas a las 14. Vacío (o `abierto: false`) = cerrado ese día.
 */
export interface DiaAtencion {
  /** 0 = domingo … 6 = sábado. */
  dow: number;
  abierto: boolean;
  tramos: HourRange[];
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
  /** Pedir confirmación de la cita. Variables: {{nombre}} {{servicio}} {{fecha}}. */
  askConfirm: string;
  /** Info de un servicio. Variables: {{servicio}} {{descripcion}} {{precio}} {{duracion}}. */
  serviceInfo: string;
  /** Mensaje final cuando la cita queda agendada. Variables: {{nombre}} {{servicio}} {{fecha}} {{agenda}}. */
  captured: string;
  /** Respuesta cuando no se entendió el mensaje. */
  fallback: string;
  /**
   * Recordatorio de la cita vigente (T-20): lo que responde el motor
   * determinista cuando el lead ya confirmó (`datos_completos`) y escribe
   * algo que no es ni elegir otro servicio ni una regla rápida (un saludo,
   * un "gracias", etc.) — sin bajar el stage ni re-mandar el menú. Opcional:
   * sin configurar, se usa un default razonable (ver `responder.ts`).
   */
  citaVigente?: string;
  /** T-21: pedir cuánto quiere de un producto. Variables: {{nombre}} {{servicio}}. */
  askCantidad?: string;
  /**
   * T-21: pedir confirmación de un pedido (varios ítems, no una fecha). El
   * motor le antepone el detalle del carrito y el total — este texto es solo
   * el cierre ("¿confirmás tu pedido?"), no necesita variables.
   */
  askConfirmPedido?: string;
  /**
   * T-21/PR5: lo que se le dice al cliente justo después de confirmar el
   * pedido, mientras se espera que la dueña lo acepte o lo rechace por
   * WhatsApp — el motor le antepone el detalle del carrito y el total, este
   * texto es solo el cierre ("quedó en revisión").
   */
  esperandoAprobacion?: string;
  /**
   * T-21/PR5: cierre cuando la DUEÑA acepta el pedido (análogo a `captured`,
   * pero sin fecha/agenda). Antes del PR5 este texto se usaba apenas el
   * cliente decía "sí" — ahora se envía recién cuando la dueña aprueba.
   */
  pedidoConfirmado?: string;
  /** T-21/PR5: lo que se le dice al cliente cuando la dueña RECHAZA el pedido. Variables: {{nombre}}. */
  pedidoRechazado?: string;
  /**
   * T-21: recordatorio del pedido vigente, análogo a `citaVigente` pero para
   * un pedido ya confirmado (sin fecha que mencionar). Desde el PR5 es en la
   * práctica inalcanzable en el camino normal (un pedido "pagado" muere de
   * una, ver `pedido-lifecycle.ts`) — queda como red de seguridad.
   */
  pedidoVigente?: string;
  /**
   * T-24.4: se le dice al cliente en vez de `esperandoAprobacion` cuando el
   * negocio tiene `pagos.requiereComprobante` — acá todavía no se avisó a la
   * dueña, se espera que el cliente pague y mande la foto del comprobante.
   * Nunca debe sonar a confirmación (§1.6): el motor le antepone el detalle
   * del carrito y el total, este texto es solo el pedido de la foto.
   */
  pedirComprobante?: string;
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
  /**
   * Rubro en lenguaje natural (p. ej. "restaurante", "estética y belleza").
   * Se le pasa a la IA en modo agente para que actúe con el criterio de ese
   * rubro. Puramente informativo: no cambia el comportamiento del motor.
   */
  rubro?: string;
  /** Código de moneda (p. ej. "COP"). */
  currency: string;
  /** Locale para formatear precios (p. ej. "es-CO"). */
  locale?: string;
  /** Catálogo de servicios. */
  services: Service[];
  /**
   * Forma del catálogo de este rubro (T-21): etiquetas, camino por defecto de
   * los ítems y qué campos mostrar. Sin esto, todo se comporta como antes.
   */
  catalogo?: CatalogoConfig;
  /** Plantillas de mensajes. */
  messages: MessageTemplates;
  /** Configuración de seguimientos (2h / 1d / 3d). */
  followUps: FollowUpConfig[];
  /** Link de agenda opcional (Calendly, Google Calendar…). */
  bookingUrl?: string;
  /** Zona horaria IANA del negocio (p. ej. "America/Bogota"). Default America/Bogota. */
  timezone?: string;
  /** Dirección física del negocio (visible en Configuración del portal). */
  direccion?: string;
  /** Si es `false`, el bot está en pausa y no responde mensajes. Default `true`. */
  botActivo?: boolean;
  /** Plan comercial (pill del back office). Default "free". */
  plan?: "free" | "pro";
  /** Horarios de atención (los usa el bot y la sección Citas del portal). */
  horarios?: DiaAtencion[];
  /** Cerebro del bot: IA (knowledge) + reglas rápidas + fallback/derivación. */
  ai?: BotAIConfig;
  /** Modalidad de entrega opcional (retirar / comer en el local, etc.). */
  pedidos?: PedidosConfig;
  /**
   * WhatsApp personal de la dueña/o (E.164, ej. "573001234567"). Si está
   * configurado, el bot le avisa por WhatsApp cuando se confirma una cita o
   * pedido (usa el mismo número de WhatsApp Business del negocio para enviar).
   */
  notifyPhoneNumber?: string;
  /** Confirmación de pago (T-24.4) — Nivel 1 del plan de pagos, ver `docs/15-plan-vision-tienda.md` §1.6. */
  pagos?: PagosConfig;
  /** Persona del bot por canal. Si un canal no está, se omite la IA para ese canal. */
  personas?: Partial<Record<Channel, PersonaConfig>>;
  /** Almacenamiento propio del negocio (multi-tenant). Sin esto cae a JSON local. */
  storage?: {
    /** ID de la planilla de Google Sheets de este negocio. */
    spreadsheetId?: string;
    /** ID del Google Calendar del negocio (su email o un id @group.calendar.google.com). */
    calendarId?: string;
  };
}

/** Evento de calendario normalizado, independiente del proveedor (Google, etc.). */
export interface CalendarEvent {
  /** Título visible del evento (p. ej. "Limpieza facial - Laura"). */
  summary: string;
  /** Detalle opcional (texto original de la fecha, contacto, etc.). */
  description?: string;
  /** Inicio en ISO 8601 con offset (p. ej. "2026-06-30T15:00:00-05:00"). */
  startISO: string;
  /** Fin en ISO 8601 (inicio + duración del servicio). */
  endISO: string;
  /** Zona horaria IANA del evento (p. ej. "America/Bogota"). */
  timezone: string;
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
  /**
   * Presente si el mensaje trae una foto (T-23.5). `text` ya trae el caption
   * (o "" si no vino uno) — este campo es solo lo que hace falta para
   * descargarla: nunca se guarda la imagen en sí, solo se procesa en memoria.
   */
  image?: { mediaId: string; mimeType: string };
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
  /** Modalidad elegida cuando `config.pedidos.enabled` (texto de la opción). */
  entrega?: string;
  /**
   * Carrito de un pedido (T-21): ítems y cantidades. Solo lo usan los ítems
   * de modo "pedido" — un ítem de cita nunca lo toca, sigue viviendo en
   * `serviceId`/`tentativeDate`. Que este array tenga contenido es, en la
   * práctica, la señal de "esta conversación es un pedido, no una cita" (ver
   * `engine/flows/pedido.ts`).
   */
  items?: CartItem[];
  /**
   * Cuántos mensajes SEGUIDOS se fue del tema del negocio (modo agente). Se
   * resetea a 0 apenas vuelve a hablar del negocio; al llegar al límite, el
   * bot cierra la charla con amabilidad y reinicia.
   */
  offTopicCount?: number;
  state: LeadState;
  stage: ConversationStage;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
  /** ISO 8601 del último mensaje entrante del cliente (base para seguimientos). */
  lastInboundAt: string;
  /**
   * ISO 8601 de la cita/pedido resuelto por la IA a partir de `tentativeDate`
   * (T-20). `undefined` si nunca se pudo resolver una fecha exacta (negocio
   * sin IA, o fecha ambigua tipo "cuando puedas") — en ese caso el cierre
   * automático de la cita usa `confirmedAt` en su lugar (ver
   * `appointment-lifecycle.ts`).
   */
  appointmentAt?: string;
  /**
   * ISO 8601 de cuándo se confirmó la cita/pedido (T-20). Distinto de
   * `updatedAt`, que se sobreescribe en cada mensaje: este es el que permite
   * medir "hace cuánto se confirmó" para cerrar solas las citas sin fecha
   * exacta.
   */
  confirmedAt?: string;
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
