/**
 * Espanol de chat: normaliza abreviaturas, "k"/"q" y letras repetidas ANTES
 * de que el motor intente reconocer saludos, servicios o confirmaciones.
 *
 * Los clientes reales escriben rapido y mal: "k pasa si?", "kiero info d
 * unas", "mnn a las 3", "siii". Sin esto, matchService/isAffirmative/etc.
 * fallan por texto que un humano entenderia perfecto.
 *
 * expandChatSpanish() opera sobre el texto ORIGINAL (sin tocar tildes ni
 * mayusculas de antemano): solo reemplaza los TOKENS que coinciden con una
 * abreviatura conocida (comparando "doblado" via foldAccents) y deja el
 * resto EXACTAMENTE como lo escribio el cliente. Esto permite dos usos:
 *   - Para reconocer intencion (normalizeMessage en intake.ts) el resultado
 *     se vuelve a "doblar" al final, así que perder tildes ahí no importa.
 *   - Para mostrarle la fecha de vuelta al cliente (normalizeDateText) SI
 *     importa: "el sábado" debe seguir leyéndose "el sábado", no "el sabado".
 *
 * Se aplica SOLO al texto del cliente — nunca a nombres de servicio ni
 * keywords que configuró el negocio, para no alterar lo que el dueño
 * escribió a propósito.
 */

import { foldAccents } from "@/core/engine/text-normalize";

/**
 * Diccionario abreviatura -> forma completa. Las claves están "dobladas"
 * (minúsculas, sin diacríticos - ver `foldAccents`). El reemplazo es por
 * PALABRA COMPLETA, nunca dentro de otra palabra (así "y" no toca la "y" de
 * "hoy", y "d" no toca la "d" de "de").
 */
export const ABBREVIATIONS: Record<string, string> = {
  // Saludos
  hla: "hola",
  ola: "hola",
  wena: "hola",
  wenas: "hola",
  bns: "buenas",
  qtal: "que tal",
  ktal: "que tal",

  // Muletillas / conectores
  k: "que",
  q: "que",
  qe: "que",
  xq: "porque",
  pq: "porque",
  xk: "porque",
  porq: "porque",
  x: "por",
  xa: "para",
  pa: "para",
  xfa: "por favor",
  porfa: "por favor",
  porfis: "por favor",
  plis: "por favor",
  pls: "por favor",
  tb: "tambien",
  tmb: "tambien",
  tmbn: "tambien",
  bn: "bien",
  dnd: "donde",
  cdo: "cuando",
  ps: "pues",

  // Pronombres/verbos cortos
  d: "de",
  t: "te",
  m: "me",
  aser: "hacer",
  ay: "hay",

  // Tiempo (las claves ya están "dobladas": sin tilde ni ñ, ver foldAccents)
  mnn: "mañana",
  mnna: "mañana",
  manana: "mañana",
  hy: "hoy",

  // Lugar
  aki: "aqui",
  aqi: "aqui",

  // Verbos de interes
  qiero: "quiero",
  kiero: "quiero",
  kisiera: "quisiera",

  // Confirmaciones / cortesias
  grax: "gracias",
  grcs: "gracias",
  oki: "ok",
  okis: "ok",
  okey: "ok",
  nel: "no",
  sale: "si",
  simon: "si",
  sisas: "si",
};

/** Repeticion de 3+ letras iguales seguidas ("holaaa", "siiii", "porfaaa"). */
const REPEATED_LETTERS = /([a-zñáéíóú])\1{2,}/gi;

/** Colapsa letras repetidas a una sola, preservando el resto de la palabra. */
function collapseRepeatedLetters(text: string): string {
  return text.replace(REPEATED_LETTERS, "$1");
}

/** Separa signos de puntuacion pegados a la palabra ("hola?" -> "hola ?"). */
function spaceOutPunctuation(text: string): string {
  return text.replace(/([¿?¡!.,;:])/g, " $1 ");
}

/**
 * Expande el espanol de chat de un texto tal cual lo escribio el cliente:
 * colapsa letras repetidas, separa puntuacion pegada y reemplaza abreviaturas
 * token a token por su forma completa. Un token que NO está en el
 * diccionario se deja intacto (con sus tildes/mayúsculas originales).
 */
export function expandChatSpanish(text: string): string {
  const collapsed = collapseRepeatedLetters(text);
  const spaced = spaceOutPunctuation(collapsed);
  const tokens = spaced.split(/\s+/).filter(Boolean);
  const expanded = tokens.map((tok) => ABBREVIATIONS[foldAccents(tok)] ?? tok);
  return expanded.join(" ").replace(/\s+/g, " ").trim();
}
