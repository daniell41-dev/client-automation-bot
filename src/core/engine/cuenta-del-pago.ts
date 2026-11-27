/**
 * T-153: a cuál de las cuentas del negocio llegó un pago, según lo que la IA
 * leyó del comprobante. Un negocio venezolano con cuentas en Venezuela,
 * Provincial, Banesco y Pago Móvil necesita saberlo para cuadrar cada banco
 * al final del día.
 *
 * Solo se usan los datos de DESTINO. El "banco" que aparece en una captura
 * casi siempre es el de la app del cliente (desde dónde pagó): usarlo diría
 * "llegó a Banesco" cuando el cliente solo pagó desde Banesco.
 *
 * Esto identifica, no verifica: que el pago sea real lo sigue decidiendo la
 * dueña (decisión §1.6 del plan de pagos).
 */

import type { PaymentReceiptDescription } from "@/core/ai/payment-receipt-schema";
import { foldAccents } from "@/core/engine/text-normalize";
import type { CuentaPago } from "@/core/types";

export type CuentaDelPago =
  | { tipo: "cuenta"; cuenta: CuentaPago }
  /** El comprobante muestra un número de destino y no es de ninguna cuenta del negocio. */
  | { tipo: "no_coincide" }
  /** No hay datos de destino, o alcanzan para varias cuentas: no se adivina. */
  | { tipo: "sin_datos" };

/** Con menos dígitos visibles, coincidir con el final de una cuenta es casualidad. */
const MIN_DIGITOS = 4;

const digitos = (t: string | undefined) => (t ?? "").replace(/\D/g, "");

/** Los dígitos visibles de un número enmascarado ("****1234" → "1234"; "01**1234" → "1234"). */
function finalVisible(t: string | undefined): string {
  const partes = (t ?? "").split(/[*xX•]+/);
  return digitos(partes[partes.length - 1]);
}

const nombreBanco = (t: string) =>
  foldAccents(t)
    .toLowerCase()
    .replace(/\b(banco|bco|de|del|la|el|c\.?a\.?|s\.?a\.?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "BANESCO" ↔ "Banesco", "Bco. de Venezuela" ↔ "Banco de Venezuela". */
function mismoBanco(a: string, b: string): boolean {
  const x = nombreBanco(a);
  const y = nombreBanco(b);
  return Boolean(x && y) && (x.includes(y) || y.includes(x));
}

/** El celular comparable: los últimos 10 dígitos ("0412-5550101" y "+58 412 5550101" son el mismo). */
const celular = (t: string | undefined) => {
  const d = digitos(t);
  return d.length >= 7 ? d.slice(-10) : "";
};

export function cuentaDelPago(comprobante: PaymentReceiptDescription, cuentas: CuentaPago[]): CuentaDelPago {
  const conNumero = cuentas.filter((c) => digitos(c.numero).length > 0);
  if (conNumero.length === 0) return { tipo: "sin_datos" };

  // 1. El número de cuenta de destino: lo más seguro, aunque venga enmascarado.
  const visible = finalVisible(comprobante.cuentaDestino);
  if (visible.length >= MIN_DIGITOS) {
    const porNumero = conNumero.filter((c) => digitos(c.numero).endsWith(visible));
    if (porNumero.length === 1) return { tipo: "cuenta", cuenta: porNumero[0] };
    if (porNumero.length === 0) return { tipo: "no_coincide" };
  }

  // 2. El celular de un Pago Móvil o una billetera.
  const tel = celular(comprobante.telefonoDestino);
  if (tel) {
    const porTelefono = conNumero.filter((c) => celular(c.numero) === tel);
    if (porTelefono.length === 1) return { tipo: "cuenta", cuenta: porTelefono[0] };
  }

  // 3. Cédula o titular, desempatando con el banco de destino: la misma
  // persona puede tener varias cuentas (Luis Rojas en Provincial y Banesco).
  const documento = digitos(comprobante.documentoDestino);
  const nombre = comprobante.nombreDestino ? foldAccents(comprobante.nombreDestino).toLowerCase() : "";
  let candidatas = conNumero.filter((c) => {
    if (documento.length >= 6 && digitos(c.documento) === documento) return true;
    const titular = c.titular ? foldAccents(c.titular).toLowerCase().split(/\s+/).filter((p) => p.length > 2) : [];
    return nombre !== "" && titular.length > 0 && titular.every((p) => nombre.includes(p));
  });
  const banco = comprobante.bancoDestino;
  if (banco) {
    const delBanco = (candidatas.length ? candidatas : conNumero).filter((c) => mismoBanco(c.entidad, banco));
    // Solo con el banco (sin cédula ni titular) se acepta si el negocio tiene una sola cuenta en ese banco.
    if (delBanco.length > 0) candidatas = delBanco;
  }
  return candidatas.length === 1 ? { tipo: "cuenta", cuenta: candidatas[0] } : { tipo: "sin_datos" };
}

/** "Banesco · Luis Rojas (…1234)": lo que lee la dueña para saber en qué banco buscar la plata. */
export function describirCuenta(cuenta: CuentaPago): string {
  const entidad = cuenta.tipo === "pago_movil" ? `Pago Móvil ${cuenta.entidad.trim()}` : cuenta.entidad.trim();
  const titular = cuenta.titular?.trim();
  const ultimos = digitos(cuenta.numero).slice(-4);
  return `${entidad}${titular ? ` · ${titular}` : ""}${ultimos ? ` (…${ultimos})` : ""}`;
}
