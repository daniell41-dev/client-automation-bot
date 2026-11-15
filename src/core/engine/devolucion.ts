/**
 * Devoluciones (T-67): qué pasa con la plata de un pedido rechazado.
 *
 * El bot no mueve dinero: la dueña devuelve desde su banco. Lo que hace el
 * bot es pedirle al cliente a qué cuenta, anotarla y recordársela a la dueña
 * hasta que ella marque que ya devolvió. Funciones puras, sin I/O.
 */

import type { EstadoDevolucion, Pedido } from "@/core/storage/pedido-repository";

/**
 * Mínimo de dígitos para tomar un mensaje como cuenta. Un Nequi tiene 10 y
 * una cuenta de ahorros 10-11; 6 deja pasar llaves cortas y cuentas viejas.
 * Lo que importa es lo contrario: que "hola", "quiero otro plato" o "sí 2"
 * NO se anoten como cuenta, porque esa conversación sigue su curso normal.
 */
const MIN_DIGITOS_CUENTA = 6;

/** ¿El mensaje parece una cuenta para devolver la plata? */
export function pareceCuenta(texto: string): boolean {
  // Los separadores de un número de cuenta ("300 123 4567", "123-456789-01")
  // no cortan la secuencia.
  const secuencias = texto.replace(/(\d)[\s.-]+(?=\d)/g, "$1").match(/\d+/g) ?? [];
  return secuencias.some((s) => s.length >= MIN_DIGITOS_CUENTA);
}

/** Devoluciones que la dueña todavía tiene que hacer (o esperan la cuenta del cliente). */
export function devolucionPendiente(pedido: Pick<Pedido, "devolucion">): boolean {
  const estado: EstadoDevolucion | undefined = pedido.devolucion?.estado;
  return estado === "pidiendo_cuenta" || estado === "pendiente";
}

/**
 * Lo que se le pide al cliente al rechazar. "Si la transferencia salió de tu
 * cuenta" y no "te devolvemos": el bot no sabe si la plata llegó (pudo ir a
 * otra cuenta, o el pantallazo ser falso). Lo comprueba la dueña en su banco.
 */
export function mensajePedirCuenta(montoTexto: string): string {
  return `Si la transferencia de ${montoTexto} salió de su cuenta, envíenos el banco o Nequi, el número y el nombre del titular, y se la devolvemos 🙏`;
}

export function mensajeCuentaRecibida(numeroPedido: number, montoTexto: string): string {
  return `Listo, anotamos su cuenta para devolverle ${montoTexto} del pedido #${numeroPedido}. Le avisamos apenas esté hecho 🙏`;
}

export function avisoCuentaParaDueña(pedido: Pick<Pedido, "numero" | "cliente" | "contacto">, montoTexto: string, cuenta: string): string {
  return [
    `💸 Cuenta para devolver ${montoTexto} del pedido #${pedido.numero} (${pedido.cliente ?? pedido.contacto}):`,
    cuenta,
    "Cuando devuelva el dinero, márquelo en el panel → Pedidos → Devoluciones.",
  ].join("\n");
}

export function mensajeDevuelto(numeroPedido: number, montoTexto: string): string {
  return `Ya le devolvimos ${montoTexto} del pedido #${numeroPedido}. Revise su cuenta y cualquier cosa nos escribe 🙏`;
}
