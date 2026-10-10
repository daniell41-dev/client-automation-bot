/**
 * Motor de señales de riesgo de un comprobante de pago (T-24.3, §1.7 del
 * plan). Función PURA, sin IA y sin I/O: recibe lo que ya se leyó del
 * comprobante (T-24.2), el pedido y los datos de pago del negocio, y
 * devuelve las señales que encuentra. Quien llama es responsable de traer
 * los comprobantes previos del negocio (esta función no consulta nada).
 *
 * Ninguna señal rechaza por sí sola (§1.7: "el bot nunca rechaza solo,
 * porque un falso positivo le cuesta un cliente real") — el resultado se
 * guarda en `comprobantes.señales` y se le muestra a la dueña (T-24.4), que
 * es quien decide.
 */

import type { PaymentReceiptDescription } from "@/core/ai/payment-receipt-schema";
import { normalizarReferencia, normalizarTelefono } from "@/core/engine/datos-pago";

export type NivelSeñal = "alta" | "media" | "baja";

export type TipoSeñal =
  | "referencia_repetida"
  | "monto_distinto"
  | "destino_no_coincide"
  | "fecha_vieja"
  | "fecha_futura"
  | "rafaga";

export interface Señal {
  tipo: TipoSeñal;
  nivel: NivelSeñal;
  /** Texto listo para mostrarle a la dueña, con los datos concretos que dispararon la señal. */
  detalle: string;
}

/** Un comprobante previo del negocio, lo mínimo para detectar referencia repetida y ráfaga. */
export interface ComprobantePrevio {
  referencia?: string;
  /** Mismo identificador que `IncomingMessage.from` — para detectar ráfaga del mismo cliente. */
  contacto: string;
  /** ISO 8601 de cuándo se RECIBIÓ este comprobante (no la fecha que dice el comprobante). */
  creadoEn: string;
}

export interface DatosPagoNegocio {
  /** Cuenta/teléfono que el negocio declaró como destino real de sus pagos. */
  telefonoDestino?: string;
  /**
   * T-45: todas las cuentas del negocio. El comprobante coincide si el pago
   * fue a CUALQUIERA de ellas — con varias cuentas, pagarle a la otra no es
   * fraude.
   */
  destinos?: string[];
  comprobantesPrevios?: ComprobantePrevio[];
}

export interface PedidoEsperado {
  total: number;
}

/** Un comprobante con más de esto se marca "fecha vieja". */
const HORAS_COMPROBANTE_VIEJO = 24;
/** Tolerancia de reloj antes de marcar una fecha como "futura". */
const MINUTOS_TOLERANCIA_FUTURO = 5;
/** Ventana para contar comprobantes del mismo cliente como ráfaga. */
const MINUTOS_VENTANA_RAFAGA = 10;
/** Con esta cantidad de comprobantes previos del mismo cliente en la ventana, ya es ráfaga. */
const RAFAGA_MINIMO_PREVIOS = 2;

export function calcularSeñalesPago(
  comprobante: PaymentReceiptDescription,
  pedido: PedidoEsperado,
  negocio: DatosPagoNegocio,
  contactoCliente: string,
  ahora: Date,
): Señal[] {
  const señales: Señal[] = [];
  const previos = negocio.comprobantesPrevios ?? [];

  // T-33: se compara normalizado de los dos lados — los comprobantes
  // guardados antes de T-33 tienen la referencia tal como la leyó la IA.
  const referencia = normalizarReferencia(comprobante.referencia);
  if (referencia) {
    const repetida = previos.some((p) => normalizarReferencia(p.referencia) === referencia);
    if (repetida) {
      señales.push({
        tipo: "referencia_repetida",
        nivel: "alta",
        detalle: `La referencia "${comprobante.referencia}" ya se usó antes en este negocio.`,
      });
    }
  }

  if (comprobante.monto !== undefined && comprobante.monto !== pedido.total) {
    señales.push({
      tipo: "monto_distinto",
      nivel: "media",
      detalle: `El comprobante dice ${comprobante.monto}, el pedido es ${pedido.total}.`,
    });
  }

  const destinoComprobante = normalizarTelefono(comprobante.telefonoDestino);
  const destinosNegocio = [negocio.telefonoDestino, ...(negocio.destinos ?? [])]
    .map(normalizarTelefono)
    .filter((d): d is string => d !== undefined);
  if (destinoComprobante && destinosNegocio.length > 0 && !destinosNegocio.includes(destinoComprobante)) {
    señales.push({
      tipo: "destino_no_coincide",
      nivel: "alta",
      detalle: `El comprobante dice que se pagó a ${comprobante.telefonoDestino}, no al número registrado del negocio.`,
    });
  }

  if (comprobante.fechaISO) {
    const fecha = new Date(comprobante.fechaISO);
    if (!Number.isNaN(fecha.getTime())) {
      const diffMs = ahora.getTime() - fecha.getTime();
      if (diffMs < -MINUTOS_TOLERANCIA_FUTURO * 60 * 1000) {
        señales.push({
          tipo: "fecha_futura",
          nivel: "alta",
          detalle: `El comprobante tiene fecha futura (${comprobante.fechaISO}).`,
        });
      } else if (diffMs > HORAS_COMPROBANTE_VIEJO * 60 * 60 * 1000) {
        señales.push({
          tipo: "fecha_vieja",
          nivel: "media",
          detalle: `El comprobante tiene más de ${HORAS_COMPROBANTE_VIEJO}h (${comprobante.fechaISO}).`,
        });
      }
    }
  }

  const ventanaMs = MINUTOS_VENTANA_RAFAGA * 60 * 1000;
  const recientesDelContacto = previos.filter((p) => {
    if (p.contacto !== contactoCliente) return false;
    const creado = new Date(p.creadoEn).getTime();
    if (Number.isNaN(creado)) return false;
    const diff = ahora.getTime() - creado;
    return diff >= 0 && diff <= ventanaMs;
  });
  if (recientesDelContacto.length >= RAFAGA_MINIMO_PREVIOS) {
    señales.push({
      tipo: "rafaga",
      nivel: "media",
      detalle: `${recientesDelContacto.length} comprobantes del mismo cliente en los últimos ${MINUTOS_VENTANA_RAFAGA} minutos.`,
    });
  }

  return señales;
}
