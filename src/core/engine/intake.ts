/**
 * Intake: interpreta el texto del mensaje entrante.
 *
 * Funciones puras de reconocimiento (sin estado ni I/O): detectar saludos y
 * resolver a qué servicio se refiere el cliente (por nombre, palabra clave o
 * número de menú). El `responder` usa estas piezas para decidir la respuesta.
 */

import type { Service } from "@/core/types";

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
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** ¿El mensaje contiene un saludo? */
export function isGreeting(text: string): boolean {
  const n = normalize(text);
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
];

/**
 * ¿El mensaje es una afirmación/confirmación?
 *
 * Se usa en el paso de confirmación de cita: cualquier cosa que NO sea un "sí"
 * se interpreta como "cambiar fecha" (declinar). Coincide por palabra completa
 * para que "si" no dispare dentro de "siempre" o "sin".
 */
export function isAffirmative(text: string): boolean {
  const n = normalize(text);
  const words = n.split(/\s+/);
  return AFFIRMATIVE_WORDS.some((w) =>
    w.includes(" ") ? n.includes(w) : words.includes(w),
  );
}

/**
 * Resuelve el servicio al que se refiere el cliente.
 *
 * Prioridad: nombre del servicio o palabra clave (más específico) y, si no hay
 * coincidencia, selección por número de menú ("1", "opción 2", …).
 */
export function matchService(
  text: string,
  services: Service[],
): Service | undefined {
  const n = normalize(text);

  // 1) Por nombre o palabra clave.
  for (const service of services) {
    if (n.includes(normalize(service.name))) return service;
    for (const keyword of service.keywords ?? []) {
      if (n.includes(normalize(keyword))) return service;
    }
  }

  // 2) Por número de menú (1-based).
  const numberMatch = n.match(/\b(\d{1,2})\b/);
  if (numberMatch) {
    const index = Number.parseInt(numberMatch[1], 10) - 1;
    if (index >= 0 && index < services.length) return services[index];
  }

  return undefined;
}
