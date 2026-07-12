/**
 * Adaptador Groq para ILLMProvider.
 *
 * Groq corre modelos open-source (Llama, etc.) en hardware LPU muy rápido.
 * Free tier sin tarjeta y disponible en Colombia. Solo se instancia si
 * GROQ_API_KEY está presente.
 *
 * Crea tu key gratis en: https://console.groq.com/keys
 */

import Groq from "groq-sdk";
import type {
  DateExtractionInput,
  ILLMProvider,
  LLMContext,
} from "@/core/ai/provider";
import { buildSystemPrompt, buildUserMessage } from "@/core/ai/prompt";
import {
  buildDateExtractionPrompt,
  parseExtractedDateTime,
} from "@/core/ai/date-extraction";

/** Modelo por defecto: buena calidad en español. Configurable con GROQ_MODEL. */
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class GroqProvider implements ILLMProvider {
  private client: Groq;
  readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Groq({ apiKey });
    this.model = model;
  }

  async enhance(ctx: LLMContext): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.7,
        max_tokens: 512,
        messages: [
          { role: "system", content: buildSystemPrompt(ctx) },
          { role: "user", content: buildUserMessage(ctx) },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      return text || ctx.draftResponse;
    } catch (err) {
      // No silencioso: dejamos rastro del error real para poder diagnosticar.
      // El flujo no se rompe: caemos al borrador del motor.
      console.error("[Groq] enhance falló, usando borrador. Error:", err);
      return ctx.draftResponse;
    }
  }

  async extractDateTime(input: DateExtractionInput): Promise<string | null> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0, // determinista: queremos UNA fecha, no creatividad.
        max_tokens: 40,
        messages: [
          { role: "system", content: buildDateExtractionPrompt(input) },
          { role: "user", content: input.text },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      return parseExtractedDateTime(raw);
    } catch (err) {
      // No se rompe el flujo: sin fecha válida, no se agenda en calendario.
      console.error("[Groq] extractDateTime falló:", err);
      return null;
    }
  }
}

/** Crea un GroqProvider si GROQ_API_KEY está configurada, o devuelve null. */
export function createGroqProvider(): GroqProvider | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new GroqProvider(key, process.env.GROQ_MODEL || DEFAULT_MODEL);
}
