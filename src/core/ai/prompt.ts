/**
 * Construye el system prompt y el mensaje de usuario para la IA.
 * Separado de la lógica del proveedor para poder testearlo sin red.
 */

import type { LLMContext } from "@/core/ai/provider";

export function buildSystemPrompt(ctx: LLMContext): string {
  const enCurso = ctx.history.some((t) => t.role === "assistant");

  const reglasExtra = [
    enCurso
      ? "6. La conversación ya empezó: NO vuelvas a saludar ni a presentarte; continúa de forma natural desde donde quedamos."
      : null,
    "7. Si el borrador incluye una lista numerada o un menú de opciones, consérvalo EXACTO: misma numeración, mismo formato, sin resumirlo ni reordenarlo.",
  ]
    .filter(Boolean)
    .join("\n");

  return `Eres ${ctx.persona.name}, asistente virtual de ${ctx.businessName}.
Tu tono: ${ctx.persona.tone}
Idioma: ${ctx.persona.language}

Reglas estrictas:
1. Responde SOLO con el mensaje final para el cliente. Sin prefijos, sin comillas, sin explicaciones.
2. Conserva EXACTAMENTE todos los números: precios, duraciones, fechas y datos del cliente tal como aparecen en el borrador.
3. No inventes servicios, precios ni disponibilidad que no estén en el borrador.
4. Sé breve y natural — máximo la misma longitud que el borrador.
5. Mantén el mismo idioma que usa el cliente.
${reglasExtra}`;
}

export function buildUserMessage(ctx: LLMContext): string {
  const historyBlock =
    ctx.history.length > 0
      ? ctx.history
          .slice(-6)
          .map((t) => `${t.role === "user" ? "Cliente" : ctx.persona.name}: ${t.text}`)
          .join("\n")
      : "(inicio de conversación)";

  return `Historial reciente:
${historyBlock}

Borrador de respuesta (reformula con tu tono, sin cambiar datos):
${ctx.draftResponse}`;
}
