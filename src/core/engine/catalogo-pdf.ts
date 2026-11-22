/**
 * T-121: cuándo el bot manda el catálogo en PDF del negocio.
 *
 * Dos momentos: al saludar (si la dueña activó "Enviar el catálogo al
 * saludar") y cada vez que el cliente pide "el catálogo". Va como un mensaje
 * aparte DESPUÉS de la respuesta del bot, así el saludo o la respuesta de la
 * IA salen igual que siempre y el PDF llega detrás.
 */

import type { BusinessConfig, OutgoingMessage } from "@/core/types";
import { foldAccents } from "@/core/engine/text-normalize";

/** Pie del documento: corto y fijo, no pasa por la IA. */
export const TEXTO_CATALOGO = "Aquí está nuestro catálogo 📄";

/**
 * "¿Me mandas el catálogo?", "catalogo porfa", "tienen catálogos?". Se mira
 * la palabra sola y no frases enteras: es lo que escribe la gente y una
 * regla con frases se queda corta. Mandarlo de más (alguien que solo lo
 * nombra) cuesta poco; no mandarlo cuando lo pidió es lo que se nota.
 */
export function pideCatalogo(texto: string): boolean {
  return /\bcatalogos?\b/.test(foldAccents(texto));
}

/**
 * El nombre que ve el cliente siempre termina en ".pdf": sin la extensión,
 * algunos teléfonos no saben con qué abrir el archivo.
 */
function nombreConExtension(nombre: string): string {
  return /\.pdf$/i.test(nombre) ? nombre : `${nombre}.pdf`;
}

/**
 * El mensaje con el PDF, o `null` si no toca mandarlo en este turno.
 * `clienteNuevo`: es el primer mensaje de este contacto (no había lead).
 */
export function mensajeCatalogo(
  config: BusinessConfig,
  para: string,
  texto: string,
  clienteNuevo: boolean,
): OutgoingMessage | null {
  const catalogo = config.catalogoPdf;
  if (!catalogo) return null;
  const toca = (clienteNuevo && catalogo.enviarAlSaludar) || pideCatalogo(texto);
  if (!toca) return null;
  return {
    to: para,
    text: TEXTO_CATALOGO,
    documento: { url: catalogo.url, nombreArchivo: nombreConExtension(catalogo.nombreArchivo) },
  };
}
