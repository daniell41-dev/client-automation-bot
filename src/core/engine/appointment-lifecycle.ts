/**
 * Cierre automático de la cita cumplida (T-20).
 *
 * Función pura: decide si un lead ya agendado ("datos_completos") corresponde
 * cerrarlo porque el servicio ya se prestó, y cómo dejarlo listo para que el
 * bot lo reciba como un cliente que vuelve (no como alguien con una cita
 * pendiente de hace semanas).
 *
 * Tres niveles de certeza sobre "cuándo pasó la cita", de mejor a peor dato
 * disponible (ver decisión del producto en el plan T-20):
 *   1. Con `appointmentAt` (fecha real resuelta por la IA): se cierra al pasar
 *      el FIN del día de la cita, en la zona horaria del negocio — no al
 *      pasar la hora exacta, para no cerrarla mientras el servicio podría
 *      seguir en curso.
 *   2. Sin fecha exacta pero con `confirmedAt` (negocio sin IA, o fecha
 *      ambigua tipo "cuando puedas"): se cierra a los 7 días de confirmada.
 *   3. Ni una cosa ni la otra (leads de antes de esta migración, sin
 *      `appointmentAt` ni `confirmedAt`): se aproxima con 7 días desde
 *      `updatedAt`. Es transitorio — desaparece a medida que esos leads se
 *      vuelvan a mover — y lo respalda el cierre manual del portal (PR 6).
 */

import type { Lead } from "@/core/types";
import { transition } from "@/core/engine/lead-state";

/** Días sin fecha exacta (o sin ningún dato) tras los cuales se da la cita por cumplida. */
export const SIN_FECHA_EXACTA_DIAS = 7;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** "2026-06-30" en la zona horaria del negocio (para comparar días, no instantes). */
function fechaLocal(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** ¿Ya pasó el día calendario de `iso` (en `timezone`) respecto de `now`? */
function pasoElDia(iso: string, now: Date, timezone: string): boolean {
  return fechaLocal(now.toISOString(), timezone) > fechaLocal(iso, timezone);
}

function pasaronDias(desdeISO: string, now: Date, dias: number): boolean {
  return now.getTime() - new Date(desdeISO).getTime() >= dias * MS_POR_DIA;
}

/**
 * ¿Corresponde dar la cita de `lead` por cumplida? Solo aplica a leads ya
 * agendados: uno todavía esperando fecha/confirmación no tiene cita que
 * cerrar (nada que "cumplir" todavía).
 */
export function citaCumplida(lead: Lead, now: Date, timezone: string): boolean {
  if (lead.stage !== "datos_completos") return false;

  if (lead.appointmentAt) return pasoElDia(lead.appointmentAt, now, timezone);
  if (lead.confirmedAt) return pasaronDias(lead.confirmedAt, now, SIN_FECHA_EXACTA_DIAS);
  return pasaronDias(lead.updatedAt, now, SIN_FECHA_EXACTA_DIAS);
}

/**
 * Cierra la cita cumplida: copia del lead lista para recibir al mismo cliente
 * como alguien que vuelve, no como una cita pendiente. Se conserva el nombre
 * (para saludarlo) y la identidad (`id`/`contact`/`createdAt`); se limpian los
 * datos de la reserva que ya se cumplió.
 *
 * `recurrente` y no un estado nuevo: ya significa "cliente que ya recibió el
 * servicio, ofrecerle la próxima sesión" (`lead-state.ts`) y ya cuenta como
 * cerrado para el seguimiento de ventas — ver la nota en el plan T-20.
 */
export function cerrarCitaCumplida(lead: Lead, now: Date): Lead {
  return {
    ...lead,
    state: transition(lead.state, "recurrente"),
    stage: "inicio",
    serviceId: undefined,
    tentativeDate: undefined,
    entrega: undefined,
    appointmentAt: undefined,
    confirmedAt: undefined,
    followUpsSent: [],
    // Mismo criterio que `limpiarDatos` en `agent.ts`: un conteo de "fuera de
    // tema" viejo no debe arrastrarse a la charla nueva.
    offTopicCount: 0,
    updatedAt: now.toISOString(),
  };
}
