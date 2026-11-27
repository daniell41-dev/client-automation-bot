/**
 * T-155: el cliente pide hablar con una persona.
 *
 * Antes el asistente seguía respondiendo como si nada: el cliente que ya no
 * quería hablar con él se iba. Ahora se le avisa a la dueña con el link para
 * escribirle y el asistente se calla SOLO en esa conversación (el resto de
 * clientes sigue atendido).
 *
 * Por qué callarse y no seguir en paralelo: la dueña le escribe desde su
 * propio WhatsApp y Meta no le avisa al sistema lo que ella dice. Si el
 * asistente siguiera, el cliente recibiría dos respuestas distintas.
 *
 * La pausa vence sola a las 12 horas: si la dueña olvida reactivarlo, ese
 * cliente no debe quedar sin atención para siempre.
 */

import type { BusinessConfig, Lead } from "@/core/types";

export const HORAS_ATENCION_HUMANA = 12;

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A quién puede pedir: una persona, la dueña, un asesor… */
const ALGUIEN =
  "(?:una persona|alguien(?: real)?|un humano|una humana|un ser humano|un asesor(?:a)?|una asesora|un agente|la duena|el dueno|el encargado|la encargada|el administrador|la administradora|un empleado|una empleada|el jefe|la jefa)";

const PATRONES = [
  // "hablar con una persona", "me comunica con un asesor", "pásame con la dueña"
  new RegExp(`\\b(?:hablar|comunicar|comunicarme|comunica|comunique|contactar|pasar|pasame|paseme|pasen|comuniqueme)\\b[^.?!]{0,25}\\bcon ${ALGUIEN}`),
  // "quiero un humano", "necesito una persona real"
  /\b(?:quiero|necesito|prefiero)\b[^.?!]{0,15}\b(?:un humano|una persona real|alguien real|un ser humano)\b/,
  // "no quiero hablar con un bot / robot / máquina"
  /\bno quiero (?:hablar|chatear|escribir)(?:le)? con (?:un|una|el|la)? ?(?:bot|robot|maquina|asistente virtual|ia|inteligencia artificial)\b/,
];

export function pideHablarConPersona(texto: string): boolean {
  const t = normalizar(texto);
  return PATRONES.some((p) => p.test(t));
}

export function enAtencionHumana(lead: Pick<Lead, "atencionHumanaDesde"> | null, now: Date): boolean {
  if (!lead?.atencionHumanaDesde) return false;
  const desde = new Date(lead.atencionHumanaDesde).getTime();
  if (Number.isNaN(desde)) return false;
  return now.getTime() - desde < HORAS_ATENCION_HUMANA * 60 * 60 * 1000;
}

/** Lo que lee el cliente. No promete una hora: la dueña puede estar ocupada. */
export function mensajeAlCliente(config: BusinessConfig): string {
  return `Claro, ya le aviso al equipo de ${config.name} 🙌 En breve le escribe una persona por aquí o desde su WhatsApp.`;
}

/** El aviso para la dueña: quién, qué dijo y el link para escribirle de una. */
export function textoAvisoDuena(
  config: BusinessConfig,
  lead: Pick<Lead, "contact" | "name"> & Partial<Pick<Lead, "channel">>,
  mensaje: string,
): string {
  const numero = lead.contact.replace(/\D/g, "");
  // En Instagram el contacto es un id de Instagram, no un teléfono: no hay link de WhatsApp.
  const porWhatsapp = lead.channel !== "instagram" && numero.length >= 7;
  return [
    `🙋 ${config.name}: un cliente quiere hablar con una persona.`,
    `Cliente: ${lead.name ?? lead.contact}`,
    `Dijo: «${mensaje.trim().slice(0, 200)}»`,
    porWhatsapp ? `Escríbale aquí: https://wa.me/${numero}` : "Respóndale desde la bandeja de Instagram del negocio.",
    `El asistente no le responde a este cliente por ${HORAS_ATENCION_HUMANA} horas, o hasta que lo reactive en Conversaciones del portal.`,
  ].join("\n");
}

/** Desde cuándo una pausa sigue vigente: lo que el portal filtra en la base. */
export function inicioPausasVigentes(now: Date): string {
  return new Date(now.getTime() - HORAS_ATENCION_HUMANA * 60 * 60 * 1000).toISOString();
}
