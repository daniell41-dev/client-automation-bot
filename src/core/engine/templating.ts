/**
 * Motor de plantillas mínimo.
 *
 * Reemplaza variables con la forma `{{nombre}}` dentro de un texto. Es la base
 * de todos los mensajes del bot, que se definen como plantillas en la config de
 * cada negocio para poder personalizarse sin tocar el core.
 */

export type TemplateVars = Record<string, string | number | undefined | null>;

/**
 * Renderiza una plantilla reemplazando `{{clave}}` por su valor.
 *
 * - Tolera espacios dentro de las llaves: `{{ nombre }}`.
 * - Una variable ausente (o `undefined`/`null`) se reemplaza por cadena vacía,
 *   de modo que nunca queda un `{{...}}` colgando en el mensaje enviado.
 *
 * @example
 * render("Hola {{nombre}} 💜", { nombre: "Laura" }) // "Hola Laura 💜"
 */
export function render(template: string, vars: TemplateVars = {}): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
