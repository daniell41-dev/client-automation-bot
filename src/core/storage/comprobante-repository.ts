/**
 * Comprobantes de pago (T-24.1) — Nivel 1 del plan de pagos (§1.6 del plan):
 * triaje asistido, nunca verificación. Guardar un comprobante NO significa
 * que el pago sea real; es la pieza de datos que el motor de señales
 * (T-24.3) y la dueña (T-24.4) usan para decidir.
 *
 * `crear` lanza si la `referencia` ya se usó en este mismo negocio — es la
 * señal antifraude más fuerte que existe sin acceso al banco (§1.7), y se
 * impone en la base (índice único), no leyendo-y-comparando desde acá.
 */

export interface NuevoComprobante {
  /** UUID del negocio en Supabase, o su slug en el fallback JSON local. */
  negocio: string;
  leadId?: string;
  /** Normalizada: sin espacios, mayúsculas — la normalización es responsabilidad de quien llama. */
  referencia?: string;
  monto?: number;
  moneda?: string;
  banco?: string;
  /** ISO 8601 de la fecha que trae el comprobante (no de cuándo se procesó). */
  fechaComprobante?: string;
  /** Resultado de `señales-pago.ts` (T-24.3), tal cual, para mostrarle a la dueña. */
  señales?: unknown;
}

export type EstadoComprobante = "pendiente" | "aprobado" | "rechazado";

export interface Comprobante extends NuevoComprobante {
  id: string;
  estado: EstadoComprobante;
  /** ISO 8601 de cuándo se RECIBIÓ este comprobante (no la fecha que dice el comprobante). */
  creadoEn: string;
}

export interface ComprobanteRepository {
  /**
   * Inserta un comprobante nuevo en estado `"pendiente"`. Lanza si
   * `referencia` ya se usó en este negocio (índice único
   * `comprobantes_ref_unica`, migración 0013) — nunca se resuelve en
   * silencio, quien llama decide qué decirle al cliente/dueña ante el
   * rechazo.
   */
  crear(comprobante: NuevoComprobante): Promise<Comprobante>;

  /**
   * Todos los comprobantes de un negocio (T-24.4) — lo que necesita
   * `señales-pago.ts` para detectar referencia repetida y ráfaga. No pagina
   * ni filtra por fecha: el volumen esperado por negocio es bajo.
   */
  listar(negocio: string): Promise<Comprobante[]>;
}
