/**
 * Proveedor generico OpenAI-compatible.
 *
 * Gemini, Groq y Cerebras (y un Ollama propio) exponen el mismo protocolo
 * POST {baseURL}/chat/completions con el formato de OpenAI. En vez de un SDK
 * por proveedor, un solo adaptador con `fetch` que cualquiera de ellos puede
 * usar solo cambiando `baseURL`/`model` (ver `presets.ts`).
 *
 * Mismo patron que `WhatsAppChannel` en `channels/whatsapp/send.ts`: la
 * construccion del request es una funcion PURA (`buildChatRequest`) para
 * poder testearla sin red. A diferencia del viejo `GroqProvider`, este
 * provider LANZA en error HTTP/red/timeout — no se traga el error — porque
 * quien decide si cae al siguiente proveedor de la cadena o al borrador es
 * `ResilientProvider` (`resilient.ts`), no esta clase.
 */

import type {
  DateExtractionInput,
  ILLMProvider,
  InterpretInput,
  LLMContext,
} from "@/core/ai/provider";
import { buildSystemPrompt, buildUserMessage } from "@/core/ai/prompt";
import {
  buildDateExtractionPrompt,
  parseExtractedDateTime,
} from "@/core/ai/date-extraction";
import { buildInterpretPrompt, parseInterpretation } from "@/core/ai/interpret";

export interface OpenAICompatibleOptions {
  /** Nombre corto para logs/errores (p. ej. "gemini", "groq"). */
  name: string;
  /** URL base SIN `/chat/completions` (p. ej. ".../v1beta/openai"). */
  baseURL: string;
  apiKey: string;
  model: string;
  /** Inyectable para tests; por defecto el `fetch` global. */
  fetchImpl?: typeof fetch;
  /** Timeout de la llamada en ms (default 8000; Vercel Hobby corta a 10s). */
  timeoutMs?: number;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatCompletionParams {
  temperature: number;
  maxTokens: number;
}

export interface SendRequest {
  url: string;
  init: RequestInit;
}

/** Construye la URL y el cuerpo de una petición de chat completions. */
export function buildChatRequest(
  opts: { baseURL: string; apiKey: string; model: string },
  messages: ChatMessage[],
  params: ChatCompletionParams,
): SendRequest {
  const url = `${opts.baseURL.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: opts.model,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    messages,
  };
  return {
    url,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  };
}

/** Forma mínima esperada de una respuesta de chat completions. */
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export class OpenAICompatibleProvider implements ILLMProvider {
  readonly model: string;
  private readonly name: string;
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    this.baseURL = opts.baseURL;
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  /** Llamada cruda de chat completions. Lanza si falla (red, HTTP, timeout). */
  private async chatCompletion(
    messages: ChatMessage[],
    params: ChatCompletionParams,
  ): Promise<string> {
    const { url, init } = buildChatRequest(
      { baseURL: this.baseURL, apiKey: this.apiKey, model: this.model },
      messages,
      params,
    );
    const res = await this.fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`[${this.name}] HTTP ${res.status}: ${detail}`);
    }
    const data = (await res.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`[${this.name}] respuesta vacía`);
    return text;
  }

  async enhance(ctx: LLMContext): Promise<string> {
    return this.chatCompletion(
      [
        { role: "system", content: buildSystemPrompt(ctx) },
        { role: "user", content: buildUserMessage(ctx) },
      ],
      { temperature: 0.7, maxTokens: 512 },
    );
  }

  async extractDateTime(input: DateExtractionInput): Promise<string | null> {
    const raw = await this.chatCompletion(
      [
        { role: "system", content: buildDateExtractionPrompt(input) },
        { role: "user", content: input.text },
      ],
      { temperature: 0, maxTokens: 40 },
    );
    return parseExtractedDateTime(raw);
  }

  async interpret(input: InterpretInput): Promise<string | null> {
    const raw = await this.chatCompletion(
      [
        { role: "system", content: buildInterpretPrompt(input) },
        { role: "user", content: input.text },
      ],
      { temperature: 0, maxTokens: 30 },
    );
    return parseInterpretation(raw, input.options);
  }
}
