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
 * "Salvo que el tono del negocio indique otra cosa": el preset "Cercano" del
 * portal pide tutear, y esa es una decisión de la dueña. El voseo no lo pide
 * ningún negocio de Colombia, así que ese queda prohibido siempre.
 */
export const TRATO_AL_CLIENTE =
  "Escríbele al cliente en español de Colombia y trátalo de usted, salvo que el tono del negocio indique otra cosa. Nunca uses voseo (vos, tenés, querés, confirmás).";
