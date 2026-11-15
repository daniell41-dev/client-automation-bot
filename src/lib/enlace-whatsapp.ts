/**
 * T-80: enlaces de la landing hacia el WhatsApp de ventas de Aurela.
 *
 * Cada botón precarga un mensaje distinto. Así, cuando alguien escribe, se
 * sabe desde qué parte de la página llegó (el hero, la sección de precio, la
 * barra del celular o el cierre) sin instalar analítica ni cookies.
 *
 * Pura y sin `process.env`: el número entra por parámetro (lo pone
 * `landing-config.ts`), así se testea sin tocar variables de entorno.
 */

export const MENSAJES_WHATSAPP = {
  hero: "Hola, vi la página de Aurela y quiero saber cómo funcionaría en mi negocio.",
  precios: "Hola, quiero saber el precio y los cupos para instalar Aurela en mi negocio.",
  "barra-movil": "Hola, estoy viendo la página de Aurela desde el celular y quiero más información.",
  cierre: "Hola, quiero ver Aurela funcionando con mi negocio.",
  // T-83: el botón de la sección del comprobante anotado.
  comprobante: "Hola, quiero saber cómo Aurela revisa los comprobantes.",
} as const;

export type OrigenWhatsApp = keyof typeof MENSAJES_WHATSAPP;

/**
 * El texto de cada botón. Antes todos decían "Escríbanos por WhatsApp" y se
 * leía repetido; ahora cada uno dice qué va a pasar según la sección, en la
 * línea del mensaje que precarga. Solo la barra fija del celular queda
 * genérica, porque acompaña toda la página. Cortos: caben en una línea a 320 px.
 */
export const ETIQUETAS_WHATSAPP: Record<OrigenWhatsApp, string> = {
  hero: "Probarlo en mi negocio",
  precios: "Pedir instalación gratis",
  "barra-movil": "Escríbanos por WhatsApp",
  cierre: "Quiero verlo funcionando",
  comprobante: "Ver cómo revisa los pagos",
};

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

/** Enlace al Instagram de Aurela a partir del usuario (con o sin @) o de la URL; `null` si no hay. */
export function enlaceInstagram(valor: string | undefined): string | null {
  const limpio = (valor ?? "").trim();
  if (!limpio) return null;
  if (/^https?:\/\//i.test(limpio)) return limpio;
  return `https://www.instagram.com/${limpio.replace(/^@/, "")}`;
}
