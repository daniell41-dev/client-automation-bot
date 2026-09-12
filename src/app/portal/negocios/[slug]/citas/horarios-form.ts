/**
 * Lógica pura del editor de horarios de atención (T-20): armar las 7 filas
 * fijas (lunes a domingo) a partir de un `config.horarios` que puede venir
 * vacío, incompleto o en el formato viejo (ya descartado por
 * `businessConfigSchema` con `.catch(undefined)` — ver `config-schema.ts`).
 *
 * Separado del componente (que es "use client") para poder testearlo sin
 * infraestructura de componentes, que este repo no tiene (sin jsdom).
 */

import type { DiaAtencion } from "@/core/types";

/** Nombre del día en español a partir de `dow` (0 = domingo … 6 = sábado). */
export const NOMBRES_DIA: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

/** Orden de exhibición en el editor: lunes primero, domingo último. */
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** Cuántos tramos como máximo admite el editor por día (alcanza para el corte de mediodía). */
export const MAX_TRAMOS_POR_DIA = 2;

function diaVacio(dow: number): DiaAtencion {
  return { dow, abierto: false, tramos: [] };
}

/**
 * Devuelve EXACTAMENTE 7 filas, una por día de la semana, en el orden de
 * exhibición del editor (`ORDEN_SEMANA`). Si `horarios` trae una entrada
 * para ese `dow`, se usa tal cual; si no, el día queda cerrado sin tramos.
 * Nunca lanza: un `horarios` con `dow` repetidos o fuera de rango [0,6]
 * simplemente ignora las entradas inválidas/repetidas (se queda con la
 * primera que matchee cada día).
 */
export function buildSieteFilas(horarios: DiaAtencion[] | undefined): DiaAtencion[] {
  const porDia = new Map<number, DiaAtencion>();
  for (const dia of horarios ?? []) {
    if (dia.dow >= 0 && dia.dow <= 6 && !porDia.has(dia.dow)) {
      porDia.set(dia.dow, dia);
    }
  }
  return ORDEN_SEMANA.map((dow) => porDia.get(dow) ?? diaVacio(dow));
}
