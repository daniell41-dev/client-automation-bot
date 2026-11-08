/**
 * Validación de una cita contra los horarios de atención del negocio (T-20).
 *
 * Función pura: recibe la fecha/hora YA resuelta a ISO (por
 * `llm.extractDateTime`, ver `handle.ts`) y decide si cae dentro de algún
 * tramo de atención del día que le toca — en la zona horaria del negocio,
 * nunca en UTC crudo (una cita de las 23:00 en Bogotá no puede caer "al día
 * siguiente" solo porque el servidor calcula en UTC).
 *
 * `horarios` es intencionalmente `undefined`-friendly: un negocio sin
 * horarios cargados no valida nada (se comporta igual que antes de T-20).
 */

import type { DiaAtencion, HourRange } from "@/core/types";

export type MotivoRechazoHorario =
  | "cerrado_ese_dia"
  | "fuera_de_horario"
  | "no_termina_antes_del_cierre";

export type ResultadoHorario =
  | { ok: true }
  | {
      ok: false;
      motivo: MotivoRechazoHorario;
      /** Texto listo para ofrecerle al cliente: qué sí se puede ese día. */
      alternativa: string;
    };

const NOMBRES_DIA: Record<number, string> = {
  0: "domingo",
  1: "lunes",
  2: "martes",
  3: "miércoles",
  4: "jueves",
  5: "viernes",
  6: "sábado",
};

/** "09:30" → 570 (minutos desde medianoche). */
function parseHora(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 570 → "09:30". */
function formatMinutos(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Día de la semana (0 = domingo … 6 = sábado, igual que `Date.getDay()`) y
 * minutos desde medianoche de `iso`, EN LA ZONA HORARIA DEL NEGOCIO — nunca
 * `Date.getDay()`/`getHours()` directo, que leen la hora del servidor (UTC).
 */
function horaLocal(iso: string, timezone: string): { dow: number; minutos: number } {
  const WEEKDAY_A_DOW: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date(iso));
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return { dow: WEEKDAY_A_DOW[weekday], minutos: hour * 60 + minute };
}

/**
 * Última hora de inicio (en minutos, o formateada como "HH:MM") que permite
 * que un servicio de `durationMinutes` termine antes del cierre de alguno de
 * los tramos del día. `null` si ningún tramo alcanza para esa duración
 * (servicio más largo que cualquier tramo de atención).
 */
export function ultimoInicioPosible(dia: DiaAtencion, durationMinutes: number): string | null {
  let mejor: number | null = null;
  for (const tramo of dia.tramos) {
    const inicioMax = parseHora(tramo.hasta) - durationMinutes;
    if (inicioMax >= parseHora(tramo.desde)) {
      mejor = mejor === null ? inicioMax : Math.max(mejor, inicioMax);
    }
  }
  return mejor === null ? null : formatMinutos(mejor);
}

/** Texto de los tramos de un día, p. ej. "09:00 a 13:00 y 15:00 a 19:00". */
function textoTramos(tramos: HourRange[]): string {
  return tramos.map((t) => `${t.desde} a ${t.hasta}`).join(" y ");
}

/** Días (en orden lunes→domingo) con al menos un tramo de atención. */
function resumenDiasAbiertos(horarios: DiaAtencion[]): string {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const abiertos = orden
    .map((dow) => horarios.find((d) => d.dow === dow))
    .filter((d): d is DiaAtencion => Boolean(d?.abierto && d.tramos.length > 0));
  if (abiertos.length === 0) return "en este momento no tenemos días de atención cargados";
  return abiertos.map((d) => NOMBRES_DIA[d.dow]).join(", ");
}

/**
 * ¿La cita de `durationMinutes` que empieza en `startISO` cae dentro de
 * algún tramo de atención? `undefined`/vacío en `horarios` ⇒ siempre válida
 * (sin horarios cargados, no hay nada contra qué validar).
 */
export function validarCita(
  startISO: string,
  durationMinutes: number,
  horarios: DiaAtencion[] | undefined,
  timezone: string,
): ResultadoHorario {
  if (!horarios?.length) return { ok: true };

  const { dow, minutos: inicio } = horaLocal(startISO, timezone);
  const dia = horarios.find((d) => d.dow === dow);
  const fin = inicio + durationMinutes;

  if (!dia || !dia.abierto || dia.tramos.length === 0) {
    return {
      ok: false,
      motivo: "cerrado_ese_dia",
      alternativa: `Los ${NOMBRES_DIA[dow]} no atendemos. Atendemos: ${resumenDiasAbiertos(horarios)}.`,
    };
  }

  const cabeCompleta = dia.tramos.some(
    (t) => inicio >= parseHora(t.desde) && fin <= parseHora(t.hasta),
  );
  if (cabeCompleta) return { ok: true };

  // El inicio cae dentro de un tramo, pero el servicio no alcanza a terminar
  // antes del cierre de ESE tramo — distinto de pedir una hora que ya está
  // fuera de cualquier tramo del día.
  const empiezaDentroDeUnTramo = dia.tramos.some(
    (t) => inicio >= parseHora(t.desde) && inicio < parseHora(t.hasta),
  );

  const ultimo = ultimoInicioPosible(dia, durationMinutes);
  const alternativa = ultimo
    ? `Los ${NOMBRES_DIA[dow]} atendemos ${textoTramos(dia.tramos)}. Para un servicio de ${durationMinutes} minutos, el último turno posible es a las ${ultimo}.`
    : `Los ${NOMBRES_DIA[dow]} atendemos ${textoTramos(dia.tramos)}, pero no alcanza para un servicio de ${durationMinutes} minutos ese día.`;

  return {
    ok: false,
    motivo: empiezaDentroDeUnTramo ? "no_termina_antes_del_cierre" : "fuera_de_horario",
    alternativa,
  };
}
