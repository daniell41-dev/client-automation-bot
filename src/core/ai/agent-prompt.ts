/**
 * Construye el prompt del "modo agente" y valida la respuesta cruda del
 * modelo. Separado del proveedor para poder testear sin red las dos piezas
 * con más riesgo: qué se le pide a la IA y, sobre todo, qué se acepta de
 * vuelta (nunca se confía a ciegas — ver `parseAgentResponse`).
 */

import type { AgentTurnInput } from "@/core/ai/provider";
import { agentResponseSchema, type AgentResponse } from "@/core/ai/agent-schema";

/** Formatea un precio según la moneda/locale del negocio (igual criterio que el motor). */
function formatPrice(input: AgentTurnInput, price: number): string {
  try {
    return new Intl.NumberFormat(input.locale ?? "es-CO", {
      style: "currency",
      currency: input.currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price} ${input.currency}`;
  }
}

function buildCatalogBlock(input: AgentTurnInput): string {
  return input.services
    .map((s) => {
      const categoria = s.categoria ? ` (${s.categoria})` : "";
      return `- id="${s.id}" | ${s.name}${categoria}: ${s.description}. Precio: ${formatPrice(input, s.price)}. Duración: ${s.durationMinutes} minutos.`;
    })
    .join("\n");
}

function buildHorariosBlock(input: AgentTurnInput): string {
  if (!input.horarios?.length) return "";
  const abiertos = input.horarios.filter((h) => h.abierto);
  const lineas = abiertos.length
    ? abiertos.map((h) => `- ${h.dia}: ${h.desde} a ${h.hasta}`).join("\n")
    : "Cerrado todos los días (confirmar con el cliente).";
  return `\n\nHorarios de atención:\n${lineas}`;
}

function buildPedidosBlock(input: AgentTurnInput): string {
  if (!input.pedidos) return "";
  return `\n\nEste negocio pregunta la modalidad de entrega antes de confirmar: "${input.pedidos.pregunta}" — opciones EXACTAS: ${input.pedidos.opciones.join(", ")}.`;
}

function buildKnowledgeBlock(input: AgentTurnInput): string {
  const knowledge = input.knowledge?.trim();
  if (!knowledge) return "";
  return `\n\nInformación adicional del negocio (usala para responder preguntas; nunca inventes algo que no esté acá ni en el catálogo):\n${knowledge}`;
}

function buildDatosConocidos(input: AgentTurnInput): string {
  const partes = [
    input.lead.name ? `nombre: ${input.lead.name}` : null,
    input.lead.serviceId ? `servicio elegido (id): ${input.lead.serviceId}` : null,
    input.lead.tentativeDate ? `fecha tentativa: ${input.lead.tentativeDate}` : null,
    input.lead.entrega ? `modalidad de entrega: ${input.lead.entrega}` : null,
  ].filter((p): p is string => p !== null);
  return partes.length > 0 ? partes.join(", ") : "ninguno todavía";
}

/**
 * Aviso destacado cuando la cita/pedido YA está confirmada. Sin esto la IA
 * no tiene forma de saberlo y vuelve a pedir datos o a re-confirmar algo
 * que el cliente ya cerró.
 */
function buildConfirmadoBlock(input: AgentTurnInput): string {
  if (!input.lead.yaConfirmado) return "";
  return `\n\n⚠️ IMPORTANTE: la cita/pedido de este cliente YA ESTÁ CONFIRMADA con los datos de arriba. NO vuelvas a pedirle el nombre, el servicio ni la fecha, y NO uses la acción "confirmar" otra vez. Si te agradece o se despide, respondé con calidez y cerrá. Si pregunta algo sobre su cita, respondé con esos datos. Si quiere agendar algo MÁS (otro servicio), tratalo como una reserva NUEVA: declarás "elegir_servicio" y le pedís la fecha de esa nueva cita.`;
}

function buildOffTopicNote(input: AgentTurnInput): string {
  if (input.lead.offTopicCount <= 0) return "";
  const vez = input.lead.offTopicCount === 1 ? "vez" : "veces";
  return `\n\nEl cliente ya se desvió del tema del negocio ${input.lead.offTopicCount} ${vez} en esta conversación. Si vuelve a hacerlo, sé breve, amable, y redirigí hacia el negocio.`;
}

/**
 * Arma el system prompt del modo agente: quién es, qué sabe (SOLO catálogo +
 * knowledge), qué ya se sabe del cliente, y el contrato de acciones/JSON.
 */
export function buildAgentSystemPrompt(input: AgentTurnInput): string {
  const rubroTexto = input.rubro ? ` (rubro: ${input.rubro})` : "";
  return `Sos ${input.persona.name}, el/la mejor asistente de ventas de "${input.businessName}"${rubroTexto}.
Tu tono: ${input.persona.tone}
Idioma: ${input.persona.language}

Tu trabajo es actuar como un vendedor experto de este negocio: entendé lo que el cliente necesita, respondé sus preguntas con criterio real (no repitas un guion armado), resolvé objeciones, y guialo hacia agendar/pedir cuando tenga sentido — usando SOLO la información de abajo. Cuestioná lo que el cliente escribe con sentido común: si algo no tiene sentido o falta información, preguntá; no lo inventes ni lo aceptes a ciegas.

Catálogo de servicios (los ÚNICOS que existen — nunca inventes otro, otro precio ni otra duración):
${buildCatalogBlock(input)}${buildHorariosBlock(input)}${buildPedidosBlock(input)}${buildKnowledgeBlock(input)}

Datos que ya tenés de este cliente: ${buildDatosConocidos(input)}.${buildConfirmadoBlock(input)}${buildOffTopicNote(input)}

Acciones disponibles (declará las que correspondan a este turno, pueden ser varias si el cliente dio varios datos juntos, o ninguna):
- "elegir_servicio": el cliente eligió (o cambió) de servicio. Usá el id EXACTO del catálogo de arriba.
- "guardar_nombre": el cliente dio su nombre real (no una pregunta, no un saludo).
- "guardar_fecha": el cliente dio una fecha/hora real (no una pregunta).
- "guardar_modalidad": SOLO si este negocio pregunta modalidad de entrega (ver arriba) — usá el texto EXACTO de una de sus opciones.
- "confirmar": SOLO cuando ya tengas nombre + servicio + fecha (+ modalidad, si este negocio la usa). Si falta algo, pedilo en tu respuesta y NO declares esta acción.
- "fuera_de_contexto": el mensaje no tiene NADA que ver con este negocio (política, deportes, chistes, otro tema totalmente ajeno). Respondé breve y amablemente, y redirigí hacia el negocio.
- "reiniciar": el cliente dice que los datos que tenemos están MAL o quiere empezar de cero ("yo no pedí nada", "ese no es mi nombre", "cambié de idea", "empecemos de nuevo", "cancelá todo"). Borra todo lo capturado. Es tu ÚNICA forma de corregir un dato viejo o equivocado: las demás acciones solo agregan, no borran. Si sospechás que un dato guardado no corresponde a esta conversación, usá esta acción en vez de seguir adelante con él.

Respondé ÚNICAMENTE un JSON con esta forma exacta, sin texto fuera del JSON ni markdown:
{"respuesta": "tu respuesta para el cliente", "acciones": [{"tipo": "..."}]}
Si no corresponde ninguna acción, "acciones" va vacío: [].`;
}

/** Arma el mensaje de usuario: historial reciente + el mensaje actual del cliente. */
export function buildAgentUserMessage(input: AgentTurnInput): string {
  const historyBlock =
    input.history.length > 0
      ? input.history
          .slice(-10)
          .map((t) => `${t.role === "user" ? "Cliente" : input.persona.name}: ${t.text}`)
          .join("\n")
      : "(inicio de conversación)";

  return `Historial reciente:\n${historyBlock}\n\nMensaje actual del cliente: ${input.message}`;
}

/** Cuántos caracteres del texto crudo del modelo se conservan para loguear un fallo. */
const RAW_LOG_LIMIT = 300;

/**
 * Resultado de intentar parsear la respuesta del modelo. A diferencia de un
 * simple `null`, `motivo` + `raw` le dan a quien llama (`openai-compatible.ts`)
 * algo concreto para loguear — sin esto, un fallo de parseo era indistinguible
 * de cualquier otro y quedaba completamente en silencio.
 */
export type AgentParseResult =
  | { ok: true; value: AgentResponse }
  | { ok: false; motivo: "vacio" | "no-json" | "schema"; raw: string };

/**
 * Parsea y valida la respuesta cruda del modelo contra el contrato. Tolera
 * que venga envuelta en fences de markdown (```json ... ```). Nunca se confía
 * a ciegas en la salida del modelo: si no es JSON válido o no cumple la forma
 * esperada, devuelve `ok: false` con el motivo y un recorte del texto crudo.
 */
export function parseAgentResponse(raw: string): AgentParseResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  if (!cleaned) return { ok: false, motivo: "vacio", raw: raw.slice(0, RAW_LOG_LIMIT) };

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return { ok: false, motivo: "no-json", raw: cleaned.slice(0, RAW_LOG_LIMIT) };
  }

  const result = agentResponseSchema.safeParse(json);
  if (!result.success) {
    return { ok: false, motivo: "schema", raw: cleaned.slice(0, RAW_LOG_LIMIT) };
  }
  return { ok: true, value: result.data };
}
