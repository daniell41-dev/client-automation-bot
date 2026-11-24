/**
 * T-113: los tiempos del seguimiento que puede elegir la dueña. Listas
 * cerradas a propósito: todo cae dentro de la ventana de 24 h de WhatsApp
 * (con el margen de media hora de `seguimientos.ts`), así que no hay forma de
 * configurar un mensaje que Meta descartaría sin avisar. `0` en el segundo =
 * no mandar segundo mensaje.
 */
export const OPCIONES_PRIMERO_MIN = [30, 60, 120, 240] as const;
export const OPCIONES_SEGUNDO_MIN = [0, 8 * 60, 12 * 60, 20 * 60, 23 * 60] as const;
