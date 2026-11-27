/**
 * Ventas del día y el resumen que le llega a la dueña al cierre.
 *
 * "Vendido" es solo lo que la dueña ya aceptó (aprobado, listo o
 * entregado). Antes el portal sumaba también lo que esperaba su respuesta,
 * así que el total del día podía bajar al rechazar un pedido: un número que
 * se mueve hacia atrás no sirve para saber cuánto se vendió.
 *
 * Es "vendido", no "ganancia": el sistema no conoce lo que le cuesta cada
 * producto a la dueña (a propósito, la columna Costo de un archivo nunca se
 * importa: la IA no debe poder decírsela a un cliente).
 *
 * Funciones puras: el reloj y los pedidos entran por parámetro.
 */

import type { BusinessConfig } from "@/core/types";
import { DEFAULT_TIMEZONE } from "@/core/timezone";
import { formatoPrecio } from "@/core/moneda";

export const ESTADOS_VENDIDOS = new Set(["aprobado", "listo", "entregado"]);
const ESTADOS_POR_RESPONDER = new Set(["esperando_pago", "por_verificar"]);

/** Lo mínimo de un pedido que hace falta para contar ventas (sirve con la fila de Supabase). */
export interface PedidoVenta {
  estado: string;
  total: number | string;
  moneda: string;
  created_at: string;
  items?: { nombre?: string; cantidad?: number }[] | null;
}

export interface VentasDelDia {
  vendidos: number;
  /** `null` si hubo pedidos en más de una moneda (sumarlas no significa nada). */
  total: number | null;
  moneda: string | null;
  /** Pedidos de hoy que todavía esperan la respuesta de la dueña. */
  porAprobar: number;
  masPedido: { nombre: string; cantidad: number } | null;
}

/** Hora y minuto locales del negocio y el día de la semana (0 = domingo). */
function horaLocal(now: Date, timezone: string): { dow: number; minutos: number; y: number; m: number; d: number } {
  const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const v = (t: string) => partes.find((p) => p.type === t)!.value;
  return {
    dow: DOW[v("weekday")],
    minutos: Number(v("hour")) * 60 + Number(v("minute")),
    y: Number(v("year")),
    m: Number(v("month")),
    d: Number(v("day")),
  };
}

/**
 * La medianoche de HOY en la hora del negocio. El servidor corre en UTC: con
 * `setHours(0,0,0,0)` el "día" en Colombia empezaba a las 7 p. m. del día
 * anterior y los pedidos de la noche se contaban mañana.
 */
export function inicioDelDia(now: Date, timezone: string = DEFAULT_TIMEZONE): Date {
  const { y, m, d, minutos } = horaLocal(now, timezone);
  // Minutos transcurridos desde la medianoche local, restados al instante actual.
  const segundos = now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
  const candidato = new Date(now.getTime() - minutos * 60_000 - segundos);
  // Comprobación: debe caer en el mismo día local (cubre cambios de horario).
  const c = horaLocal(candidato, timezone);
  return c.y === y && c.m === m && c.d === d ? candidato : new Date(Date.UTC(y, m - 1, d));
}

export function ventasDelDia(pedidos: PedidoVenta[], desde: Date): VentasDelDia {
  const deHoy = pedidos.filter((p) => new Date(p.created_at) >= desde);
  const vendidos = deHoy.filter((p) => ESTADOS_VENDIDOS.has(p.estado));
  const monedas = new Set(vendidos.map((p) => p.moneda));
  const total =
    vendidos.length === 0 ? 0 : monedas.size === 1 ? vendidos.reduce((acc, p) => acc + Number(p.total), 0) : null;

  const cantidades = new Map<string, number>();
  for (const p of vendidos) {
    // `items` viene de una columna jsonb: si no es una lista, se ignora.
    for (const item of Array.isArray(p.items) ? p.items : []) {
      if (!item?.nombre) continue;
      cantidades.set(item.nombre, (cantidades.get(item.nombre) ?? 0) + (item.cantidad ?? 1));
    }
  }
  const [masPedido] = [...cantidades.entries()].sort((a, b) => b[1] - a[1]);

  return {
    vendidos: vendidos.length,
    total,
    moneda: monedas.size === 1 ? [...monedas][0] : null,
    porAprobar: deHoy.filter((p) => ESTADOS_POR_RESPONDER.has(p.estado)).length,
    masPedido: masPedido ? { nombre: masPedido[0], cantidad: masPedido[1] } : null,
  };
}

function formatoMoneda(monto: number, moneda: string): string {
  return formatoPrecio(monto, moneda);
}

/** El mensaje de cierre para la dueña. Corto: se lee en la pantalla de bloqueo. */
export function textoResumenDiario(negocio: string, v: VentasDelDia): string {
  const lineas = [`📊 Resumen de hoy en ${negocio}:`];
  if (v.vendidos === 0) {
    lineas.push("Hoy no hubo pedidos aprobados.");
  } else {
    const pedidos = v.vendidos === 1 ? "1 pedido" : `${v.vendidos} pedidos`;
    lineas.push(
      v.total !== null && v.moneda ? `Vendió ${formatoMoneda(v.total, v.moneda)} en ${pedidos}.` : `Vendió ${pedidos}.`,
    );
  }
  if (v.masPedido) lineas.push(`Lo más pedido: ${v.masPedido.nombre} (${v.masPedido.cantidad}).`);
  if (v.porAprobar > 0) {
    lineas.push(
      v.porAprobar === 1 ? "1 pedido espera su respuesta en el panel." : `${v.porAprobar} pedidos esperan su respuesta en el panel.`,
    );
  }
  return lineas.join("\n");
}

/** Sin horarios cargados, el día "cierra" a las 9 p. m. */
const CIERRE_POR_DEFECTO = 21 * 60;
/** Cuánto después del cierre todavía se manda (el cron corre cada 15 min; si estuvo caído, no se manda a medianoche). */
const VENTANA_MIN = 3 * 60;

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * ¿Ya es hora del resumen de hoy? Después de que cierra el último tramo de
 * atención del día (o a las 9 p. m. si no hay horarios o hoy no abre), y
 * hasta 3 horas después. Que no se repita lo controla quien envía (una fila
 * por negocio y día en la base).
 */
export function tocaResumenDiario(config: BusinessConfig, now: Date): boolean {
  if (!config.resumenDiario?.activo) return false;
  const { dow, minutos } = horaLocal(now, config.timezone ?? DEFAULT_TIMEZONE);
  const dia = config.horarios?.find((h) => h.dow === dow);
  const cierre =
    dia?.abierto && dia.tramos.length ? Math.max(...dia.tramos.map((t) => aMinutos(t.hasta))) : CIERRE_POR_DEFECTO;
  return minutos >= cierre && minutos < cierre + VENTANA_MIN;
}

/** Lo que necesita `procesarResumenDiario` del mundo exterior, para probarlo sin base ni WhatsApp. */
export interface DependenciasResumen {
  /** `true` si este proceso se quedó con el envío de hoy (nadie lo había mandado). */
  reclamar(fecha: string): Promise<boolean>;
  pedidosDesde(desde: Date): Promise<PedidoVenta[]>;
  enviar(texto: string): Promise<void>;
}

/** "2026-11-25": el día local del negocio, para no mandar dos resúmenes el mismo día. */
export function fechaLocal(now: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const { y, m, d } = horaLocal(now, timezone);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Manda el resumen de hoy de UN negocio si toca. Devuelve `true` si salió.
 *
 * El orden importa: primero se reclama el día (atómico en la base) y después
 * se envía. Si el envío fallara, ese día queda sin resumen; al revés, dos
 * ejecuciones del cron podrían mandarlo dos veces, y un mensaje repetido a
 * la dueña es peor que uno que no llegó.
 *
 * Un día sin ningún pedido no se manda: "hoy no vendió nada" todos los días
 * de un negocio que recién empieza sería ruido.
 */
export async function procesarResumenDiario(
  config: BusinessConfig,
  now: Date,
  deps: DependenciasResumen,
): Promise<boolean> {
  if (!config.notifyPhoneNumber || !tocaResumenDiario(config, now)) return false;
  const tz = config.timezone ?? DEFAULT_TIMEZONE;
  const pedidos = await deps.pedidosDesde(inicioDelDia(now, tz));
  const ventas = ventasDelDia(pedidos, inicioDelDia(now, tz));
  if (ventas.vendidos === 0 && ventas.porAprobar === 0) return false;
  if (!(await deps.reclamar(fechaLocal(now, tz)))) return false;
  await deps.enviar(textoResumenDiario(config.name, ventas));
  return true;
}
