/**
 * T-80: lo que se ajusta de la landing sin tocar sus componentes.
 *
 * El número y el Instagram vienen de variables `NEXT_PUBLIC_*` porque cambian
 * por entorno (en dev no se quiere recibir chats de prueba en el WhatsApp de
 * ventas). Next las incrusta al compilar: en producción van también como
 * secretos de GitHub (docs/19-vps.md, paso 5).
 */

/** Número de ventas, formato 57XXXXXXXXXX. Sin él, los botones de WhatsApp llevan a /demo. */
export const WHATSAPP_VENTAS = process.env.NEXT_PUBLIC_WHATSAPP_VENTAS;

/** Usuario de Instagram (con o sin @) o URL completa. Sin él, el pie no lo muestra. */
export const INSTAGRAM = process.env.NEXT_PUBLIC_INSTAGRAM;

/**
 * Mensualidad "desde". `null` = no se muestra precio y la sección invita a
 * preguntar por cupos. Un precio publicado es una promesa: solo se cambia con
 * la decisión del dueño del producto (T-81: $79.900, instalación gratis y 14
 * días de prueba).
 */
export const PRECIO_DESDE: string | null = "$79.900";

/**
 * T-85: aclaración en gris bajo la lista "Incluye" de la tarjeta de precio,
 * para costos que van aparte (p. ej. lo que Meta cobra por mensajes si se pasa
 * de lo incluido, como dicen los Términos). `null` = no se muestra.
 */
export const NOTA_PRECIO: string | null = null;

export interface Testimonio {
  /** Nombre de la persona, tal como autorizó publicarlo. */
  nombre: string;
  /** Negocio y barrio, p. ej. "Asadero La 10, La Riviera". */
  negocio: string;
  texto: string;
}

/**
 * Vacío a propósito: la sección no aparece hasta que haya testimonios reales
 * y autorizados. Nunca de ejemplo ni inventados.
 */
export const TESTIMONIOS: Testimonio[] = [];

export interface Responsable {
  /** Nombre a secas (va en "{nombre}. Voy a su negocio…" y en "Le responde {nombre}."). `null` = la sección no aparece. */
  nombre: string | null;
  /** Foto en public/. Si el archivo no existe al compilar, la sección no aparece. */
  foto: string;
  /** Nota opcional sobre el piloto (p. ej. con qué negocio se probó). `null` = no se muestra. */
  piloto: string | null;
}

/**
 * T-86: quién está detrás de Nexo. Vacío a propósito: el nombre, la foto y la
 * nota del piloto los pone el dueño del producto, nunca de ejemplo. Mientras
 * falte el nombre o la foto, ni la sección ni la foto del cierre aparecen.
 */
export const RESPONSABLE: Responsable = {
  nombre: null,
  foto: "/landing/responsable.jpg",
  piloto: null,
};

/** URL pública, igual criterio que `layout.tsx`: la canónica y el JSON-LD necesitan URLs absolutas. */
export const SITIO = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
