/**
 * Construye el system prompt y el mensaje de usuario para la IA.
 * Separado de la lógica del proveedor para poder testearlo sin red.
 */

import type { LLMContext } from "@/core/ai/provider";
import { buildRulesBlock } from "@/core/ai/rules";

export function buildSystemPrompt(ctx: LLMContext): string {
  const knowledgeBlock = ctx.knowledge?.trim()
    ? `\n\nInformación del negocio (usa SOLO esto como contexto adicional; no inventes más):\n${ctx.knowledge.trim()}`
    : "";

  return `Eres ${ctx.persona.name}, asistente virtual de ${ctx.businessName}.
Tu tono: ${ctx.persona.tone}
Idioma: ${ctx.persona.language}${knowledgeBlock}

Reglas estrictas:
${buildRulesBlock(ctx)}`;
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
