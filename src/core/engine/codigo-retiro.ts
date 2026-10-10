/**
 * Código de retiro (T-37): lo que corta el fraude del pantallazo falso.
 *
 * El cliente recibe el código SOLO cuando la dueña aprobó el pedido (o Wompi
 * confirmó el pago). En el mostrador —o en la puerta, si es a domicilio— la
 * comida se entrega únicamente contra ese código. Quien pagó con un
 * comprobante falso nunca recibe aprobación, así que nunca tiene código: el
 * pantallazo deja de alcanzar para llevarse el pedido.
 */

import { esDomicilio } from "@/core/engine/flows/pedido";

/**
 * Cuatro dígitos (1000-9999): fácil de dictar en voz alta en un mostrador
 * lleno. No necesita ser secreto criptográfico — se combina con el número de
 * pedido y solo existe para pedidos ya aprobados. `aleatorio` es inyectable
 * para los tests.
 */
export function generarCodigoRetiro(aleatorio: () => number = Math.random): string {
  return String(1000 + Math.floor(aleatorio() * 9000));
}

/** Lo que se le dice al cliente junto con la confirmación. */
export function mensajeCodigoRetiro(numero: number, codigo: string, modalidad: string | undefined): string {
  const cuando = esDomicilio(modalidad)
    ? "Dáselo a quien te lo entregue para recibirlo."
    : "Mostralo al recoger tu pedido.";
  return `Tu pedido #${numero} · código de retiro: ${codigo}. ${cuando}`;
}
