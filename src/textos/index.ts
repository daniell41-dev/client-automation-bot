/**
 * T-130: textos de pantalla centralizados.
 *
 * Todo lo que la dueña o el admin leen en el portal y el back office, y que
 * no viene de la base (nombres de productos, mensajes guardados), vive en
 * `es.json`. Así un cambio de redacción ("bot" → "asistente", T-129) se hace
 * en un solo archivo y no buscando frases sueltas en 80 componentes.
 *
 * Se importa el JSON tal cual (no una función `t("clave")`): TypeScript
 * conoce cada clave, el editor las autocompleta y una clave mal escrita no
 * compila, en vez de mostrar la clave cruda en pantalla.
 *
 * La migración es por secciones (un PR por sección); lo que todavía no está
 * acá sigue escrito en su componente.
 */

import es from "./es.json";

export const textos = es;

/**
 * Rellena los `{nombre}` de un texto: formato("Hola {negocio}", { negocio: "Sabores" }).
 * Un hueco sin valor queda como está, para que se note en pantalla en vez de
 * desaparecer en silencio.
 */
export function formato(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (hueco, clave: string) =>
    clave in valores ? String(valores[clave]) : hueco,
  );
}
