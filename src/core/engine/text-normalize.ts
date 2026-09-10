/**
 * Utilidad de bajo nivel: "doblar" texto a una forma comparable (minusculas,
 * sin diacriticos - tildes, dieresis, la virgulilla de la "n" con tilde).
 *
 * Vive separada de intake.ts para que chat-spanish.ts pueda usarla sin
 * crear un import circular (intake.ts a su vez depende de chat-spanish.ts
 * para expandir abreviaturas antes de reconocer saludos/servicios).
 */
export function foldAccents(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
