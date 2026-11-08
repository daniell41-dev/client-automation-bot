/**
 * Lógica pura de `migrar-horarios.ts` (T-20): convertir el formato viejo de
 * `config.horarios` (día en texto libre) al nuevo (`dow` numérico + tramos).
 * Separada del script para poder testearla sin tocar Supabase.
 */

import type { DiaAtencion } from "@/core/types";

/** Forma del horario viejo, previo a T-20. */
export interface HorarioViejo {
  dia: string;
  desde: string;
  hasta: string;
  abierto: boolean;
}

/** Días conocidos → uno o varios `dow` (0 = domingo … 6 = sábado). */
const DIA_A_DOW: Record<string, number[]> = {
  domingo: [0],
  lunes: [1],
  martes: [2],
  miercoles: [3],
  miércoles: [3],
  jueves: [4],
  viernes: [5],
  sabado: [6],
  sábado: [6],
  "lunes a viernes": [1, 2, 3, 4, 5],
  "lunes a sabado": [1, 2, 3, 4, 5, 6],
  "lunes a sábado": [1, 2, 3, 4, 5, 6],
};

/**
 * `true` si `horarios` tiene pinta del formato viejo (al menos una entrada
 * con `dia` de texto). Un `horarios` ya en formato nuevo (con `dow`
 * numérico), vacío, o que no sea ni lo uno ni lo otro, da `false` — no hay
 * nada que convertir.
 */
export function esFormatoViejo(horarios: unknown): horarios is HorarioViejo[] {
  return (
    Array.isArray(horarios) &&
    horarios.length > 0 &&
    horarios.every((h) => h && typeof (h as { dia?: unknown }).dia === "string")
  );
}

/** Convierte UNA entrada vieja a una o varias filas nuevas, o `null` si el día no se reconoce. */
export function convertirDia(entrada: HorarioViejo): DiaAtencion[] | null {
  const dows = DIA_A_DOW[entrada.dia.trim().toLowerCase()];
  if (!dows) return null;
  return dows.map((dow) => ({
    dow,
    abierto: entrada.abierto,
    tramos: entrada.abierto ? [{ desde: entrada.desde, hasta: entrada.hasta }] : [],
  }));
}

export type ResultadoConversion =
  | { ok: true; horarios: DiaAtencion[] }
  | { ok: false; noConvertidos: string[] };

/**
 * Convierte una lista completa. Si ALGUNA entrada no se reconoce, no
 * convierte nada (conservador: mejor dejar el dato viejo intacto para
 * arreglarlo a mano que escribir un horario a medias) y devuelve qué días no
 * pudo convertir, para que el script los liste.
 */
export function convertirHorarios(entradas: HorarioViejo[]): ResultadoConversion {
  const horarios: DiaAtencion[] = [];
  const noConvertidos: string[] = [];
  for (const entrada of entradas) {
    const convertido = convertirDia(entrada);
    if (convertido) horarios.push(...convertido);
    else noConvertidos.push(entrada.dia);
  }
  if (noConvertidos.length > 0) return { ok: false, noConvertidos };
  return { ok: true, horarios };
}
