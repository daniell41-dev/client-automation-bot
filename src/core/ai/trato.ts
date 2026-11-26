/**
 * T-78: cómo se le habla al cliente final. Vive aparte porque la usan los
 * dos prompts que escriben mensajes para el cliente (`agent-prompt.ts` y
 * `prompt.ts`): si cada uno tuviera su copia, tarde o temprano dirían cosas
 * distintas.
 *
 * Es explícita a propósito. Los prompts estaban escritos en voseo ("Sos…",
 * "usá") y el modelo imita el registro de lo que lee: contestaba "¿Confirmás
 * tu pedido?" a clientes de Cúcuta. Reescribir el prompt no basta, porque el
 * modelo también arrastra el registro del historial, así que se le dice con
 * todas las letras.
 *
 * "Salvo que el tono del negocio indique otra cosa": si una dueña escribe en
 * su tono que quiere tutear, es su decisión (los presets del portal ya no lo
 * piden, ver T-79). El voseo no lo pide ningún negocio de Colombia, así que
 * ese queda prohibido siempre.
 */
export const TRATO_AL_CLIENTE =
  "Escríbele al cliente en español de Colombia y trátalo de usted, salvo que el tono del negocio indique otra cosa. Nunca uses voseo (vos, tenés, querés, confirmás). No adivines si es hombre o mujer: llámalo solo por su nombre, sin «don», «doña», «señor» ni «señora».";

/**
 * T-115b: en una prueba real la IA escribió "¡Muchas gracias, don/doña
 * Valero!": como no sabe el género, puso las dos opciones, y se lee como un
 * formulario. La regla del prompt lo pide, pero no se confía solo en eso
 * (mismo criterio que los precios, T-98): las formas con barra o paréntesis
 * se quitan del texto y queda solo el nombre. Un "Don Pedro" de verdad no se
 * toca; solo las formas que delatan que adivinó.
 */
const TRATAMIENTO_ADIVINADO =
  /\b(?:don\s*\/\s*doña|doña\s*\/\s*don|señor\s*\(a\)|señor\s*\/\s*señora|señora\s*\/\s*señor|sr\.?\s*\/\s*sra\.?|sra\.?\s*\/\s*sr\.?)(?=\s)\s*/gi;

export function quitarTratamientoAdivinado(texto: string): string {
  return texto.replace(TRATAMIENTO_ADIVINADO, "");
}
