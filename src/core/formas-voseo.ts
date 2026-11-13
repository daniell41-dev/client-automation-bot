/**
 * T-78/T-79: las formas de voseo que no pueden aparecer en nada que lea una
 * persona en Nexo. Vive en un módulo propio (y no dentro de un test) porque
 * la usan dos tests: el del bot (`src/core/sin-voseo.test.ts`) y el de las
 * pantallas (`src/sin-voseo-pantallas.test.ts`). Si cada uno tuviera su
 * lista, una forma nueva se agregaría en una y no en la otra.
 *
 * Solo para revisar textos que ESCRIBE Nexo. Lo que escribe el cliente no se
 * filtra nunca: el bot tiene que seguir entendiendo "querés" (`chat-spanish.ts`).
 */

/** Las que pidió el dueño del producto, más las que aparecían en el repo antes de T-78. */
export const FORMAS_VOSEO = [
  "vos", "sos", "tenés", "querés", "podés", "confirmás", "tocá", "respondé", "revisá", "escribí",
  "mandá", "elegí", "creá", "usá", "pedilo", "decinos", "contanos", "avisanos", "acá",
  // encontradas en el repo antes de T-78/T-79
  "necesitás", "buscás", "escribís", "reenviás", "recogés", "contame", "mandanos", "escribinos",
  "acordate", "mostralo", "mostrá", "tené", "revisalo", "revisalos", "revisala", "entregalo", "aprobalo",
  "pagá", "hacé", "ajustá", "escaneá", "probá", "contactá", "disculpá", "reservá", "confirmá",
  "agregá", "celu", "completá", "definí", "ingresá", "gestioná", "marcá", "armá", "dejá", "devolvé",
  "aprobá", "prepará", "entregá", "intentá", "corré", "invitá", "escribile", "pedile", "dejalo",
  "cerralas", "eliminalo", "repetila", "dormís", "comés", "retirás", "aprobás", "activás", "ajustás",
  "personalizás", "entrá",
];

const PATRON = new RegExp(`(?<![\\p{L}])(${FORMAS_VOSEO.join("|")})(?![\\p{L}])`, "giu");

/** Cada forma de voseo encontrada, con el texto donde está, para que el fallo de un test diga dónde mirar. */
export function buscarVoseo(textos: string[]): string[] {
  return textos.flatMap((t) => [...t.matchAll(PATRON)].map((m) => `"${m[0]}" en: ${t.slice(0, 120)}`));
}
