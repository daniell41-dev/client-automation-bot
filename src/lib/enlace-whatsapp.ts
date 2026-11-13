/**
 * T-80: enlaces de la landing hacia el WhatsApp de ventas de Nexo.
 *
 * Cada botón precarga un mensaje distinto. Así, cuando alguien escribe, se
 * sabe desde qué parte de la página llegó (el hero, la sección de precio, la
 * barra del celular o el cierre) sin instalar analítica ni cookies.
 *
 * Pura y sin `process.env`: el número entra por parámetro (lo pone
 * `landing-config.ts`), así se testea sin tocar variables de entorno.
 */

export const MENSAJES_WHATSAPP = {
  hero: "Hola, vi la página de Nexo y quiero saber cómo funcionaría en mi negocio.",
  precios: "Hola, quiero saber el precio y los cupos para instalar Nexo en mi negocio.",
  "barra-movil": "Hola, estoy viendo la página de Nexo desde el celular y quiero más información.",
  cierre: "Hola, quiero ver Nexo funcionando con mi negocio.",
} as const;

export type OrigenWhatsApp = keyof typeof MENSAJES_WHATSAPP;

/** Sin número válido el botón no puede quedar muerto: la demo es lo siguiente mejor. */
const SIN_NUMERO = "/demo";

/** Número colombiano en formato internacional, sin "+": 57 + 10 dígitos. */
const NUMERO_COLOMBIA = /^57\d{10}$/;

/**
 * `https://wa.me/<número>?text=<mensaje>` para el botón `origen`, o `/demo`
 * si el número no está configurado o no tiene la forma 57XXXXXXXXXX (un
 * número mal escrito abriría un chat con otra persona).
 */
export function enlaceWhatsApp(origen: OrigenWhatsApp, numero: string | undefined): string {
  const limpio = (numero ?? "").replace(/\D/g, "");
  if (!NUMERO_COLOMBIA.test(limpio)) return SIN_NUMERO;
  return `https://wa.me/${limpio}?text=${encodeURIComponent(MENSAJES_WHATSAPP[origen])}`;
}

/** Enlace al Instagram de Nexo a partir del usuario (con o sin @) o de la URL; `null` si no hay. */
export function enlaceInstagram(valor: string | undefined): string | null {
  const limpio = (valor ?? "").trim();
  if (!limpio) return null;
  if (/^https?:\/\//i.test(limpio)) return limpio;
  return `https://www.instagram.com/${limpio.replace(/^@/, "")}`;
}
