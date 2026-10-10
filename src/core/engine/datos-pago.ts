/**
 * Datos de cobro del negocio y normalización de lo que se compara contra un
 * comprobante (T-33).
 *
 * Funciones puras: las usa `handle.ts` para decirle al cliente A DÓNDE pagar
 * (antes el bot pedía "hacé el pago" sin dar ningún número) y
 * `señales-pago.ts` para comparar referencias y teléfonos sin que un espacio o
 * un "+57" disparen una alarma falsa.
 */

import type { PagosConfig } from "@/core/types";

/**
 * Líneas con los datos de pago del negocio, listas para el mensaje al
 * cliente. Vacío si el negocio no cargó ninguno.
 */
export function textoDatosPago(datos: PagosConfig["datosPago"]): string {
  if (!datos) return "";
  return [
    datos.nequi?.trim() ? `Nequi: ${datos.nequi.trim()}` : null,
    datos.llaveBreB?.trim() ? `Llave Bre-B: ${datos.llaveBreB.trim()}` : null,
    datos.titular?.trim() ? `A nombre de: ${datos.titular.trim()}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/**
 * Referencia comparable: sin espacios ni guiones, en mayúsculas. La IA
 * transcribe lo que ve, y el mismo comprobante puede leerse "M 0834-12" una
 * vez y "M083412" otra; sin esto, un comprobante reciclado pasaba la
 * detección de "referencia repetida".
 */
export function normalizarReferencia(referencia: string | undefined): string | undefined {
  if (!referencia) return undefined;
  const limpia = referencia.replace(/[\s-]+/g, "").toUpperCase();
  return limpia || undefined;
}

/**
 * Teléfono comparable: solo dígitos y, si es más largo, los últimos 10 (un
 * celular colombiano). Así "+57 300 123 4567", "573001234567" y
 * "300-123-4567" son el mismo número. Un comprobante que muestra el número
 * enmascarado ("***4567") no se puede comparar: devuelve `undefined` y la
 * señal no se dispara, en vez de dar una alarma falsa.
 */
export function normalizarTelefono(telefono: string | undefined): string | undefined {
  if (!telefono || /[*xX•]/.test(telefono)) return undefined;
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 7) return undefined;
  return digitos.length > 10 ? digitos.slice(-10) : digitos;
}
