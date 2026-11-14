/**
 * T-90: medición de la landing con Microsoft Clarity, solo con permiso.
 *
 * Lo que se puede probar sin navegador vive aquí (pura, sin `window` global):
 * leer y guardar la decisión del visitante, validar el ID y armar el
 * script. El componente `AvisoMedicion` solo lo conecta al DOM.
 *
 * Reglas que esto garantiza:
 * - Sin ID configurado no hay aviso ni script (no se pide un permiso que no
 *   se va a usar).
 * - Sin "Aceptar" explícito no se carga nada: "No, gracias", cerrar la
 *   pestaña o un localStorage que falla cuentan como no.
 */

export const CLAVE_DECISION = "nexo-medicion";

export type Decision = "aceptado" | "rechazado";

/** Lo mínimo de `Storage` que se usa; así el test pasa un objeto simple. */
type Almacen = Pick<Storage, "getItem" | "setItem">;

/**
 * La decisión guardada, o `null` si no hay (o no se puede leer). En modo
 * privado de Safari o con el almacenamiento bloqueado, `localStorage` lanza
 * al tocarlo: en ese caso se vuelve a preguntar, nunca se asume que sí.
 */
export function leerDecision(almacen: Almacen | null | undefined): Decision | null {
  try {
    const valor = almacen?.getItem(CLAVE_DECISION);
    return valor === "aceptado" || valor === "rechazado" ? valor : null;
  } catch {
    return null;
  }
}

/** Guarda la decisión; si el navegador no deja, la decisión vale solo para esta visita. */
export function guardarDecision(almacen: Almacen | null | undefined, decision: Decision): void {
  try {
    almacen?.setItem(CLAVE_DECISION, decision);
  } catch {
    // Sin almacenamiento no hay dónde recordarla: se respeta en memoria.
  }
}

/**
 * Los IDs de proyecto de Clarity son letras y números. Se valida porque el
 * ID va dentro de la URL de un script: un valor mal copiado (con espacios o
 * una URL entera) no debe terminar cargando otra cosa.
 */
export function clarityIdValido(id: string | null | undefined): string | null {
  const limpio = (id ?? "").trim();
  return /^[a-z0-9]{6,20}$/i.test(limpio) ? limpio : null;
}

export function urlScriptClarity(id: string): string {
  return `https://www.clarity.ms/tag/${encodeURIComponent(id)}`;
}

/** Nombre del evento de Clarity para un clic en un botón de WhatsApp. */
export function eventoWhatsApp(origen: string): string {
  return `whatsapp_${origen}`;
}

/** Rutas donde la medición nunca va: el producto y la demo, no la página de venta. */
export const RUTAS_SIN_MEDICION = ["/portal", "/backoffice", "/login", "/demo"] as const;
