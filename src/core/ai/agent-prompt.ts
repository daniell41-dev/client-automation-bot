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

/**
 * Respuestas oficiales que configuró el negocio para ciertos temas (las
 * mismas que en modo guiado tienen prioridad sobre la IA, ver `matchRule` en
 * `intake.ts`). En modo agente no son un atajo por keyword: se le pasan a la
 * IA como referencia para que no improvise cuando el negocio ya definió su
 * propia respuesta (p. ej. la política de envíos exacta).
 */
function buildReglasBlock(input: AgentTurnInput): string {
  if (!input.reglas?.length) return "";
  const lineas = input.reglas
    .map((r) => `- Sobre "${r.keywords.join('", "')}": "${r.respuesta}"`)
    .join("\n");
  return `\n\nRespuestas oficiales del negocio para estos temas (usá el mismo contenido; podés adaptar el tono, no el dato):\n${lineas}`;
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

Sé breve: máximo 2 o 3 frases, con tono de mensaje de WhatsApp real, no de folleto. Sin markdown ni listas largas, salvo que el cliente pida el menú completo.

Catálogo de servicios (los ÚNICOS que existen — nunca inventes otro, otro precio ni otra duración):
${buildCatalogBlock(input)}${buildHorariosBlock(input)}${buildPedidosBlock(input)}${buildKnowledgeBlock(input)}${buildReglasBlock(input)}

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
 * de cualquier otro y quedaba completamente en silencio. `rescatado` marca un
 * `ok: true` que no vino de un `JSON.parse` limpio (ver rescates abajo): sigue
 * siendo una respuesta usable, pero vale la pena que quede en el log.
 */
export type AgentParseResult =
  | { ok: true; value: AgentResponse; rescatado?: boolean }
  | { ok: false; motivo: "vacio" | "no-json" | "schema"; raw: string };

/**
 * Busca el primer objeto `{...}` balanceado dentro del texto (por si el
 * modelo agregó prosa antes/después del JSON, en vez de devolver SOLO el
 * JSON como se le pidió). Devuelve `null` si no encuentra ninguna llave de
 * apertura o si nunca llega a cerrar (JSON truncado a la mitad).
 */
function extraerObjetoBalanceado(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Último rescate cuando el JSON está roto o truncado: salva SOLO el texto de
 * `"respuesta"` por regex, sin adivinar nada de `acciones` (eso sí requiere
 * JSON válido). Conservador a propósito — nunca se infiere un cambio de
 * estado a partir de una respuesta rota. Prueba primero con la comilla de
 * cierre (caso normal); si no aparece, es que el string quedó truncado a la
 * mitad — se toma todo lo que haya hasta el final del texto.
 */
function rescatarTextoRespuesta(text: string): string | null {
  const match =
    text.match(/"respuesta"\s*:\s*"((?:[^"\\]|\\.)*)"/) ??
    text.match(/"respuesta"\s*:\s*"((?:[^"\\]|\\.)*)$/);
  if (!match) return null;
  try {
    // Reutiliza JSON.parse para des-escapar (\n, \", etc.) el fragmento capturado.
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    // El truncado cortó a mitad de un escape (p. ej. una "\" suelta al
    // final): el des-escapado falla, pero el texto crudo sigue siendo
    // aprovechable — mejor eso que perder el rescate por completo.
    return match[1].length > 0 ? match[1] : null;
  }
}

/**
 * Parsea y valida la respuesta cruda del modelo contra el contrato. Tolera
 * que venga envuelta en fences de markdown (```json ... ```). Si el `JSON.parse`
 * directo falla, intenta dos rescates ANTES de rendirse (ver funciones de
 * arriba): nunca se confía a ciegas en la salida del modelo, pero tampoco se
 * tira una respuesta aprovechable solo porque vino rodeada de prosa o se
 * cortó a la mitad.
 */
export function parseAgentResponse(raw: string): AgentParseResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  if (!cleaned) return { ok: false, motivo: "vacio", raw: raw.slice(0, RAW_LOG_LIMIT) };

  let json: unknown;
  let rescatado = false;
  try {
    json = JSON.parse(cleaned);
  } catch {
    const balanceado = extraerObjetoBalanceado(cleaned);
    try {
      json = balanceado ? JSON.parse(balanceado) : undefined;
    } catch {
      json = undefined;
    }
    if (json === undefined) {
      const respuesta = rescatarTextoRespuesta(cleaned);
      if (respuesta) {
        return { ok: true, value: { respuesta, acciones: [] }, rescatado: true };
      }
      return { ok: false, motivo: "no-json", raw: cleaned.slice(0, RAW_LOG_LIMIT) };
    }
    rescatado = true;
  }

  const result = agentResponseSchema.safeParse(json);
  if (!result.success) {
    if (rescatado) {
      // El objeto balanceado no cumple el contrato — probamos el último
      // rescate (solo el texto) antes de rendirnos del todo.
      const respuesta = rescatarTextoRespuesta(cleaned);
      if (respuesta) {
        return { ok: true, value: { respuesta, acciones: [] }, rescatado: true };
      }
    }
    return { ok: false, motivo: "schema", raw: cleaned.slice(0, RAW_LOG_LIMIT) };
  }
  return rescatado
    ? { ok: true, value: result.data, rescatado: true }
    : { ok: true, value: result.data };
}
