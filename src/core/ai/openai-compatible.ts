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
  AgentTurnInput,
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
import {
  buildAgentSystemPrompt,
  buildAgentUserMessage,
  parseAgentResponse,
} from "@/core/ai/agent-prompt";
import type { AgentResponse } from "@/core/ai/agent-schema";

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
  /**
   * Timeout propio para `runAgent` (default 20000). Un modelo que razona
   * tarda más que un `enhance()`/`interpret()` corto, y ese tiempo crece con
   * el catálogo + historial del prompt de agente.
   */
  agentTimeoutMs?: number;
  /**
   * `reasoning_effort` configurado para este proveedor en `runAgent()` (ver
   * `AIPreset`) — su prompt es largo y pide JSON estricto, así que necesita
   * ALGO de razonamiento ("low"), con `maxTokens` holgado para absorberlo.
   *
   * `enhance()`/`interpret()`/`extractDateTime()` son prompts cortos y
   * libres, sin esa presión — pero NO significa que no razonan si no se les
   * manda nada: Gemini 3 y `gpt-oss` (Groq) razonan por defecto igual, aunque
   * el campo venga ausente. Visto en el diagnóstico real (`pnpm ai:doctor`,
   * sept-2026): con el campo ausente, Gemini hacía timeout en `enhance()`
   * (>8s en un prompt corto) y Groq devolvía vacío (`finish_reason=length`,
   * se quedaba sin `max_tokens` pensando). Por eso estos tres métodos mandan
   * `"none"` explícito —no el valor configurado acá, que sigue siendo para
   * `runAgent()`— cuando el proveedor es de los que razonan (este campo
   * viene seteado); un proveedor sin este campo (Cerebras, custom) no lo
   * necesita y no se le manda nada, igual que antes.
   *
   * Ojo: `"none"` es DISTINTO de `"low"`. En producción, `reasoning_effort:
   * "low"` en `enhance()` con Groq hacía que el modelo, con el esfuerzo bajo
   * pero no nulo, optara por la respuesta "más segura" frente a las reglas
   * de no inventar/conservar datos: copiar el borrador sin cambios. Por eso
   * antes se optó por no mandar nada — pero "nada" resultó ser peor (timeout
   * / respuesta vacía) que mandar `"none"`, que si apaga el razonamiento del
   * todo. Si "none" reintroduce el problema de "borrador sin cambios", hay
   * que revisar de nuevo — no hay forma de probar esto sin una key real.
   */
  reasoningEffort?: string;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatCompletionParams {
  temperature: number;
  maxTokens: number;
  /**
   * Pide al proveedor que garantice JSON válido (`response_format`). Sin
   * esto, el modelo a veces envuelve el JSON en prosa o markdown y el
   * parseo falla — que en modo agente significa caer al motor determinista.
   */
  jsonMode?: boolean;
  /** `reasoning_effort` a mandar (ver `OpenAICompatibleOptions.reasoningEffort`). */
  reasoningEffort?: string;
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
    ...(params.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(params.reasoningEffort ? { reasoning_effort: params.reasoningEffort } : {}),
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
  choices?: { message?: { content?: string }; finish_reason?: string }[];
}

export class OpenAICompatibleProvider implements ILLMProvider {
  readonly model: string;
  private readonly name: string;
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly agentTimeoutMs: number;
  private readonly reasoningEffort?: string;

  constructor(opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    this.baseURL = opts.baseURL;
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
    this.agentTimeoutMs = opts.agentTimeoutMs ?? 20000;
    this.reasoningEffort = opts.reasoningEffort;
  }

  /** Llamada cruda de chat completions. Lanza si falla (red, HTTP, timeout). */
  private async chatCompletion(
    messages: ChatMessage[],
    params: ChatCompletionParams,
    timeoutMs: number = this.timeoutMs,
  ): Promise<string> {
    const { url, init } = buildChatRequest(
      { baseURL: this.baseURL, apiKey: this.apiKey, model: this.model },
      messages,
      params,
    );
    const res = await this.fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`[${this.name}] HTTP ${res.status}: ${detail}`);
    }
    const data = (await res.json()) as ChatCompletionResponse;
    const choice = data.choices?.[0];
    const text = choice?.message?.content?.trim();
    if (!text) {
      const motivo = choice?.finish_reason ? ` (finish_reason=${choice.finish_reason})` : "";
      throw new Error(`[${this.name}] respuesta vacía${motivo}`);
    }
    return text;
  }

  /**
   * `"none"` explícito si el proveedor es de los que razonan (ver el
   * comentario de `reasoningEffort` en `OpenAICompatibleOptions`) — nunca el
   * valor configurado ahí, que es para `runAgent()`.
   */
  private get noReasoning(): string | undefined {
    return this.reasoningEffort ? "none" : undefined;
  }

  async enhance(ctx: LLMContext): Promise<string> {
    return this.chatCompletion(
      [
        { role: "system", content: buildSystemPrompt(ctx) },
        { role: "user", content: buildUserMessage(ctx) },
      ],
      { temperature: 0.7, maxTokens: 512, reasoningEffort: this.noReasoning },
    );
  }

  async extractDateTime(input: DateExtractionInput): Promise<string | null> {
    const raw = await this.chatCompletion(
      [
        { role: "system", content: buildDateExtractionPrompt(input) },
        { role: "user", content: input.text },
      ],
      { temperature: 0, maxTokens: 40, reasoningEffort: this.noReasoning },
    );
    return parseExtractedDateTime(raw);
  }

  async interpret(input: InterpretInput): Promise<string | null> {
    const raw = await this.chatCompletion(
      [
        { role: "system", content: buildInterpretPrompt(input) },
        { role: "user", content: input.text },
      ],
      { temperature: 0, maxTokens: 30, reasoningEffort: this.noReasoning },
    );
    return parseInterpretation(raw, input.options);
  }

  async runAgent(input: AgentTurnInput): Promise<AgentResponse | null> {
    const raw = await this.chatCompletion(
      [
        { role: "system", content: buildAgentSystemPrompt(input) },
        { role: "user", content: buildAgentUserMessage(input) },
      ],
      // maxTokens holgado: si el modelo razona antes de responder (Gemini 3,
      // gpt-oss), esos tokens también salen de este presupuesto — si se
      // corta a la mitad, el JSON queda inválido y el turno cae al motor
      // determinista.
      {
        temperature: 0.4,
        maxTokens: 1600,
        jsonMode: true,
        reasoningEffort: this.reasoningEffort,
      },
      this.agentTimeoutMs,
    );
    const parsed = parseAgentResponse(raw);
    if (!parsed.ok) {
      console.error(
        `[${this.name}] runAgent devolvió algo inválido (${parsed.motivo}): ${parsed.raw}`,
      );
      return null;
    }
    if (parsed.rescatado) {
      console.error(
        `[${this.name}] runAgent rescató el texto de una respuesta rota/truncada (sin acciones)`,
      );
    }
    return parsed.value;
  }
}
