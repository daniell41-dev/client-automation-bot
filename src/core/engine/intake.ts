/**
 * Intake: interpreta el texto del mensaje entrante.
 *
 * Funciones puras de reconocimiento (sin estado ni I/O): detectar saludos y
 * resolver a qué servicio se refiere el cliente (por nombre, palabra clave o
 * número de menú). El `responder` usa estas piezas para decidir la respuesta.
 *
 * Comprensión de "español de chat": los clientes reales escriben rápido y
 * mal ("k pasa si?", "kiero info d uñas", "mñn a las 3"). `normalizeMessage`
 * expande esas abreviaturas (ver `chat-spanish.ts`) ANTES de reconocer
 * saludos/servicios/confirmaciones — se aplica SOLO al texto del cliente,
 * nunca a nombres de servicio ni keywords que configuró el negocio.
 */

import type { QuickRule, Service } from "@/core/types";
import { foldAccents } from "@/core/engine/text-normalize";
import { expandChatSpanish } from "@/core/engine/chat-spanish";

const GREETING_WORDS = [
  "hola",
  "holi",
  "buenas",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
  "hey",
  "que tal",
  "saludos",
  "buen dia",
];

/** Minúsculas, sin tildes y sin espacios sobrantes, para comparar de forma robusta. */
export function normalize(text: string): string {
  return foldAccents(text.trim());
}

/**
 * Expande el español de chat del cliente y lo deja listo para comparar
 * (minúsculas, sin tildes). Es lo que deben usar todas las funciones de
 * reconocimiento sobre el TEXTO DEL CLIENTE (nunca sobre config del negocio).
 */
export function normalizeMessage(text: string): string {
  return normalize(expandChatSpanish(text));
}

/** ¿El mensaje contiene un saludo? */
export function isGreeting(text: string): boolean {
  const n = normalizeMessage(text);
  return GREETING_WORDS.some((w) => n.includes(w));
}

/** Palabras que cuentan como un "sí" para confirmar (normalizadas, sin tildes). */
const AFFIRMATIVE_WORDS = [
  "si",
  "sip",
  "claro",
  "dale",
  "ok",
  "oka",
  "okay",
  "listo",
  "confirmo",
  "confirmar",
  "confirmado",
  "perfecto",
  "de una",
  "correcto",
  "obvio",
  // Variantes regionales (Venezuela y alrededores).
  "vale",
  "va",
  "hecho",
  "sale",
  "simon",
  "sisas",
];

/**
 * ¿El mensaje es una afirmación/confirmación?
 *
 * Se usa en el paso de confirmación de cita: cualquier cosa que NO sea un "sí"
 * se interpreta como "cambiar fecha" (declinar). Coincide por palabra completa
 * para que "si" no dispare dentro de "siempre" o "sin".
 */
export function isAffirmative(text: string): boolean {
  const n = normalizeMessage(text);
  const words = n.split(/\s+/);
  return AFFIRMATIVE_WORDS.some((w) =>
    w.includes(" ") ? n.includes(w) : words.includes(w),
  );
}

/** Servicios que el bot puede ofrecer (excluye los marcados `disponible: false`). */
export function availableServices(services: Service[]): Service[] {
  return services.filter((s) => s.disponible !== false);
}

/**
 * Resuelve el servicio al que se refiere el cliente.
 *
 * Prioridad: nombre del servicio o palabra clave (más específico) y, si no hay
 * coincidencia, selección por número de menú ("1", "opción 2", …). Solo
 * considera los servicios disponibles (el menú y la selección coinciden).
 */
export function matchService(
  text: string,
  services: Service[],
): Service | undefined {
  const offered = availableServices(services);
  const n = normalizeMessage(text);

  // 1) Por nombre o palabra clave.
  for (const service of offered) {
    if (n.includes(normalize(service.name))) return service;
    for (const keyword of service.keywords ?? []) {
      if (n.includes(normalize(keyword))) return service;
    }
  }

  // 2) Por número de menú (1-based).
  const numberMatch = n.match(/\b(\d{1,2})\b/);
  if (numberMatch) {
    const index = Number.parseInt(numberMatch[1], 10) - 1;
    if (index >= 0 && index < offered.length) return offered[index];
  }

  return undefined;
}

/**
 * Resuelve la modalidad de entrega elegida (p. ej. "Retirar en el local" vs
 * "Comer en el restaurante"). El cliente rara vez repite la opción completa
 * ("prefiero retirar", "en el local"), así que además de la coincidencia
 * directa se compara por palabra significativa (≥4 letras, para no matchear
 * con "en"/"el"/"la") y, si no, por número de la lista (1-based).
 */
export function matchEntrega(
  text: string,
  opciones: string[],
): string | undefined {
  const n = normalizeMessage(text);
  const words = n.split(/\s+/);

  // 1) La opción completa aparece en el mensaje.
  for (const opcion of opciones) {
    if (n.includes(normalize(opcion))) return opcion;
  }

  // 2) Alguna palabra significativa de la opción aparece en el mensaje.
  for (const opcion of opciones) {
    const opcionWords = normalize(opcion)
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    if (opcionWords.some((w) => words.includes(w))) return opcion;
  }

  // 3) Por número de la lista (1-based).
  const numberMatch = n.match(/\b(\d{1,2})\b/);
  if (numberMatch) {
    const index = Number.parseInt(numberMatch[1], 10) - 1;
    if (index >= 0 && index < opciones.length) return opciones[index];
  }

  return undefined;
}

/**
 * Busca la primera regla rápida cuya keyword aparezca en el mensaje.
 * Las reglas tienen prioridad sobre la IA (respuesta exacta del negocio).
 */
export function matchRule(
  text: string,
  reglas: QuickRule[] | undefined,
): QuickRule | undefined {
  if (!reglas?.length) return undefined;
  const n = normalizeMessage(text);
  return reglas.find((rule) =>
    rule.keywords.some((kw) => kw.trim() && n.includes(normalize(kw))),
  );
}

/** ¿`needle` aparece en `haystack` como palabra/frase completa (no substring)? */
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

/**
 * Palabras/expresiones que indican que el texto SÍ habla de una fecha/hora.
 * Se comparan por PALABRA COMPLETA (no substring): "ya" sería una señal
 * demasiado débil y ambigua además de riesgosa por substring (aparece
 * dentro de "vaya", "mayo", etc.), así que no está en la lista.
 */
const DATE_SIGNAL_WORDS = [
  "hoy",
  "manana", // sin tilde: ya viene "doblado" por normalizeMessage()
  "pasado manana",
  "ahorita",
  "ahora",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * ¿El texto parece hablar de una fecha/hora? Es la guarda que evita que
 * `esperando_fecha`/`esperando_confirmacion` acepten CUALQUIER cosa como si
 * fuera la fecha — sin esto, una pregunta del cliente ("me repites las
 * opciones?") quedaba guardada tal cual como `tentativeDate`.
 *
 * Reconoce: días/meses, "hoy"/"mañana"/"ahorita", horas ("3 pm", "a las 3",
 * "15:00"), duraciones relativas ("en 20 minutos"), fechas numéricas
 * ("15/12") y un número suelto (día del mes, p. ej. "el 20" → "20").
 */
export function looksLikeDate(text: string): boolean {
  const n = normalizeMessage(text);
  if (!n) return false;
  if (DATE_SIGNAL_WORDS.some((w) => containsWord(n, w))) return true;
  if (/\b\d{1,2}(:\d{2})?\s*(am|pm|hrs?|horas?)\b/.test(n)) return true;
  if (/\ba las?\b/.test(n)) return true;
  if (/\ben\s+\d+\s*(minutos?|horas?|dias?|semanas?)\b/.test(n)) return true;
  if (/\b\d{1,2}\/\d{1,2}\b/.test(n)) return true;
  if (/^\d{1,2}$/.test(n)) return true;
  return false;
}

/**
 * ¿El cliente está pidiendo el menú/las opciones ("me repites las
 * opciones?", "qué servicios tienen?") en vez de responder lo que se le
 * preguntó? Se usa para no confundir esto con la respuesta esperada.
 */
const MENU_REQUEST_KEYWORDS = [
  "opciones",
  "que hay",
  "que tienes",
  "que tienen",
  "que ofreces",
  "que ofrecen",
  "menu",
  "servicios",
  "repite",
  "repites",
  "repetir",
  "cuales son",
];

export function isMenuRequest(text: string): boolean {
  const n = normalizeMessage(text);
  return MENU_REQUEST_KEYWORDS.some((k) => n.includes(k));
}

/**
 * ¿El cliente pide arrancar de cero? ("reiniciar", "cancelar",
 * "empezar de nuevo"). Funciona en cualquier etapa: es la vía de escape si
 * la conversación quedó en un estado confuso.
 */
const RESET_KEYWORDS = [
  "reiniciar",
  "reinicia",
  "empezar de nuevo",
  "empezar de cero",
  "volver a empezar",
  "cancelar",
  "cancela",
  "olvida todo",
  "borra todo",
];

export function isResetRequest(text: string): boolean {
  const n = normalizeMessage(text);
  return RESET_KEYWORDS.some((k) => n.includes(k));
}

/**
 * Frases de relleno al INICIO de una fecha ("Puede ser hoy", "Creo que el
 * viernes"). Ya están "dobladas" (sin tildes): se comparan contra una copia
 * doblada del texto, pero el recorte se aplica sobre el texto ORIGINAL (con
 * tildes), porque doblar no cambia la cantidad de caracteres letra por letra.
 */
const DATE_FILLERS = [
  "puede ser",
  "podria ser",
  "seria",
  "me gustaria",
  "quisiera",
  "quiero",
  "mejor",
  "tal vez",
  "quizas",
  "creo que",
  "de pronto",
  "si se puede",
  "para",
  "el dia",
];

/** Quita muletillas iniciales, una o varias veces ("Creo que quiero mañana" → "mañana"). */
function stripLeadingFillers(text: string): string {
  let result = text.trim();
  let changed = true;
  while (changed) {
    changed = false;
    const folded = normalize(result);
    for (const filler of DATE_FILLERS) {
      if (folded === filler || folded.startsWith(`${filler} `)) {
        result = result.slice(filler.length).trim();
        changed = true;
        break;
      }
    }
  }
  return result;
}

/**
 * Limpia el texto libre de fecha/hora que da el cliente para que se lea
 * natural dentro de las plantillas ("¿Te confirmo … para {{fecha}}?").
 *
 * A diferencia de `normalizeMessage`, NO pierde tildes/mayúsculas de las
 * palabras que no son abreviaturas: "Creo que el sábado en la tarde." se
 * convierte en "el sábado en la tarde" (con tilde), no en una versión
 * doblada. Devuelve "" si no queda nada útil (solo puntuación/muletillas):
 * el llamador debe re-preguntar la fecha en ese caso.
 *
 * Ejemplos:
 *   "Puede ser hoy ?"              -> "hoy"
 *   "Podría ser mñn a las 3 pm!"   -> "mañana a las 3 pm"
 *   "Creo que el sábado en la tarde." -> "el sábado en la tarde"
 *   "el viernes"                   -> "el viernes"
 *   "???"                          -> ""
 */
export function normalizeDateText(text: string): string {
  const expanded = expandChatSpanish(text);
  // Quita puntuación/espacios sueltos al inicio y al final.
  const trimmed = expanded.replace(/^[¿?¡!.,;:\s]+|[¿?¡!.,;:\s]+$/g, "");
  if (!trimmed) return "";
  const withoutFillers = stripLeadingFillers(trimmed);
  if (!withoutFillers) return "";
  return withoutFillers.charAt(0).toLowerCase() + withoutFillers.slice(1);
}
