/**
 * Adaptador Google Gemini Flash para ILLMProvider.
 *
 * Usa gemini-2.0-flash-lite (el más rápido y económico del tier gratuito).
 * Solo se instancia si GEMINI_API_KEY está presente.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ILLMProvider, LLMContext } from "@/core/ai/provider";
import { buildSystemPrompt, buildUserMessage } from "@/core/ai/prompt";

export class GeminiProvider implements ILLMProvider {
  private model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

  constructor(apiKey: string, modelName = "gemini-2.0-flash-lite") {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  async enhance(ctx: LLMContext): Promise<string> {
    const systemInstruction = buildSystemPrompt(ctx);
    const userMessage = buildUserMessage(ctx);

    try {
      const result = await this.model.generateContent({
        systemInstruction,
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
        },
      });
      const text = result.response.text().trim();
      return text || ctx.draftResponse;
    } catch {
      // Si falla la IA, devolvemos el borrador original sin romper el flujo.
      return ctx.draftResponse;
    }
  }
}

/** Crea un GeminiProvider si GEMINI_API_KEY está configurada, o devuelve null. */
export function createGeminiProvider(): GeminiProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GeminiProvider(key);
}
