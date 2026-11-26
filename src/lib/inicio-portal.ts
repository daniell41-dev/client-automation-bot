/**
 * Primera vista del portal: qué le toca hacer hoy a la dueña, sumando todos
 * sus negocios.
 *
 * Antes la dueña entraba a una lista de negocios que solo decía "N mensajes
 * hoy", y tenía que abrir cada uno para enterarse de que había un pedido
 * esperando o un pago que no cuadraba. Estas funciones arman esa lista de
 * pendientes desde los pedidos, sin tocar la base: son puras para poder
 * probarlas sin Supabase.
 */

import { formato, textos } from "@/textos";

/** T-131: textos de "Le toca a usted" y el saludo, en `src/textos/es.json`. */
const tp = textos.portal.pendientes;

export interface SeñalPedido {
  nivel: string;
  detalle: string;
}

export interface PedidoInicio {
  negocio_id: string;
  numero: number;
  cliente: string | null;
  total: number | string;
  monto_pagado?: number | string | null;
  moneda: string;
  estado: string;
  created_at: string;
  devolucion_estado?: string | null;
  comprobantes?: { señales?: SeñalPedido[] | null } | null;
}

export interface NegocioInicio {
  id: string;
  slug: string;
  nombre: string;
}

export type TipoPendiente = "no_cuadra" | "por_aprobar" | "devolucion";

export interface Pendiente {
  tipo: TipoPendiente;
  titulo: string;
  detalle: string;
  href: string;
  /** Texto del botón: el verbo de lo que la dueña va a hacer. */
  accion: string;
}

/** Estados de devolución que esperan algo de la dueña (ver migración 0025). */
const DEVOLUCION_PENDIENTE = new Set(["pendiente", "pidiendo_cuenta"]);

export function formatoMonto(valor: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: moneda,
      maximumFractionDigits: 0,
    }).format(valor);
  } catch {
    // Una moneda que Intl no conoce no debe tumbar la página de inicio.
    return `${moneda} ${Math.round(valor).toLocaleString("es-CO")}`;
  }
}

/**
 * Un pedido "no cuadra" si el comprobante dice que pagaron menos del total o
 * si la revisión del comprobante dejó una señal alta. `monto_pagado` en 0 no
 * cuenta: significa que no se pudo leer el monto, no que pagaron cero, y
 * marcarlo como "no cuadra" asustaría a la dueña por un pedido normal.
 */
function motivoNoCuadra(p: PedidoInicio): string | null {
  const total = Number(p.total);
  const pagado = Number(p.monto_pagado ?? 0);
  if (pagado > 0 && pagado < total) {
    return formato(tp.noCuadra.pagoMenos, { pagado: formatoMonto(pagado, p.moneda), total: formatoMonto(total, p.moneda) });
  }
  const alta = (p.comprobantes?.señales ?? []).find((s) => s.nivel === "alta");
  return alta ? alta.detalle : null;
}

function quien(p: PedidoInicio): string {
  return p.cliente?.trim()
    ? formato(tp.pedidoDe, { numero: p.numero, cliente: p.cliente.trim() })
    : formato(tp.pedido, { numero: p.numero });
}

/**
 * Los pendientes de todos los negocios, en orden de urgencia: primero lo que
 * puede ser plata perdida (no cuadra), después lo que solo espera un clic
 * (aprobar), después las devoluciones. Los de "aprobar" y "devolución" se
 * agrupan por negocio para que diez pedidos no llenen la pantalla.
 */
export function armarPendientes(
  pedidos: PedidoInicio[],
  negocios: NegocioInicio[],
): Pendiente[] {
  const porId = new Map(negocios.map((n) => [n.id, n]));
  const varios = negocios.length > 1;
  const sufijo = (n: NegocioInicio) => (varios ? ` · ${n.nombre}` : "");
  const hrefPedidos = (n: NegocioInicio) => `/portal/negocios/${n.slug}/pedidos`;

  const noCuadra: Pendiente[] = [];
  const aprobar = new Map<string, number>();
  const devoluciones = new Map<string, number>();

  for (const p of pedidos) {
    const negocio = porId.get(p.negocio_id);
    if (!negocio) continue;
    if (p.estado === "por_verificar") {
      const motivo = motivoNoCuadra(p);
      if (motivo) {
        noCuadra.push({
          tipo: "no_cuadra",
          titulo: tp.noCuadra.titulo,
          detalle: `${quien(p)} · ${motivo}${sufijo(negocio)}`,
          href: hrefPedidos(negocio),
          accion: tp.noCuadra.accion,
        });
      } else {
        aprobar.set(negocio.id, (aprobar.get(negocio.id) ?? 0) + 1);
      }
    }
    if (p.devolucion_estado && DEVOLUCION_PENDIENTE.has(p.devolucion_estado)) {
      devoluciones.set(negocio.id, (devoluciones.get(negocio.id) ?? 0) + 1);
    }
  }

  const agrupados = (
    mapa: Map<string, number>,
    tipo: TipoPendiente,
    titulo: (n: number) => string,
    detalle: string,
    accion: string,
  ): Pendiente[] =>
    [...mapa].flatMap(([id, cantidad]) => {
      const negocio = porId.get(id)!;
      return [{ tipo, titulo: titulo(cantidad), detalle: `${detalle}${sufijo(negocio)}`, href: hrefPedidos(negocio), accion }];
    });

  return [
    ...noCuadra,
    ...agrupados(
      aprobar,
      "por_aprobar",
      (n) => (n === 1 ? tp.porAprobar.uno : formato(tp.porAprobar.varios, { n })),
      tp.porAprobar.detalle,
      tp.porAprobar.accion,
    ),
    ...agrupados(
      devoluciones,
      "devolucion",
      (n) => (n === 1 ? tp.devoluciones.uno : formato(tp.devoluciones.varios, { n })),
      tp.devoluciones.detalle,
      tp.devoluciones.accion,
    ),
  ];
}

/** Pedidos de hoy que cuentan como venta (los rechazados y vencidos no). */
export function pedidosDeHoy(pedidos: PedidoInicio[], desde: Date): PedidoInicio[] {
  return pedidos.filter(
    (p) => new Date(p.created_at) >= desde && p.estado !== "rechazado" && p.estado !== "vencido",
  );
}

/**
 * El total vendido hoy, o `null` si hay pedidos en más de una moneda: sumar
 * pesos con bolívares daría un número que no significa nada.
 */
export function totalVendido(pedidos: PedidoInicio[]): string | null {
  if (pedidos.length === 0) return null;
  const monedas = new Set(pedidos.map((p) => p.moneda));
  if (monedas.size !== 1) return null;
  const suma = pedidos.reduce((acc, p) => acc + Number(p.total), 0);
  return formatoMonto(suma, pedidos[0].moneda);
}

const ZONA = "America/Bogota";

/** "Buenos días" / "Buenas tardes" / "Buenas noches" en la hora de Colombia. */
export function saludo(ahora: Date, zona = ZONA): string {
  // La hora sale de la zona de la dueña y no de la del servidor (UTC en
  // Vercel): a las 8 p. m. en Cúcuta el servidor ya va por la 1 a. m.
  const hora = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: zona }).format(ahora),
  );
  if (hora >= 5 && hora < 12) return tp.saludo.manana;
  if (hora >= 12 && hora < 19) return tp.saludo.tarde;
  return tp.saludo.noche;
}

/** "Domingo 22 de noviembre". */
export function fechaLarga(ahora: Date, zona = ZONA): string {
  const texto = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: zona,
  }).format(ahora);
  const limpio = texto.replace(",", "");
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}
