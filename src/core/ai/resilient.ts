/**
 * Cadena de respaldo entre proveedores de IA.
 *
 * Envuelve una lista ordenada de `ILLMProvider` (p. ej. Gemini -> Groq ->
 * Cerebras): prueba el primero, y si LANZA (red, HTTP, timeout) pasa al
 * siguiente. Si todos fallan, `enhance` devuelve el borrador del motor y
 * `extractDateTime`/`interpret`/`runAgent` devuelven `null` — así el bot
 * nunca se cae por la IA.
 *
 * Un `null` de `extractDateTime`/`interpret` que SÍ devuelve un proveedor
 * (fecha ambigua, sin match) es una respuesta de NEGOCIO válida: no dispara
 * el paso al siguiente proveedor. `runAgent` es la excepción: ahí un `null`
 * significa "el modelo no devolvió un JSON válido", que no es una respuesta
 * de negocio — sí dispara el siguiente proveedor (ver su comentario).
 *
 * T-07: si se le pasa `usage`, registra cada intento a un proveedor (llame o
 * falle) y, si se agota toda la cadena, una caída bajo `FALLBACK_PROVIDER`.
 * Un fallo al registrar nunca rompe la respuesta real — es telemetría, no
 * lógica de negocio.
 */

import type {
  AgentTurnInput,
  DateExtractionInput,
  ILLMProvider,
  InterpretInput,
  LLMContext,
} from "@/core/ai/provider";
import type { AgentResponse } from "@/core/ai/agent-schema";
import type { AiUsageRepository } from "@/core/storage/usage-repository";

/** Proveedor recibe este identificador cuando se agota la cadena y se cae a plantilla/motor determinista. */
export const FALLBACK_PROVIDER = "fallback_plantilla";

export interface UsageContext {
  repo: AiUsageRepository;
  /** UUID del negocio en Supabase, o el slug en el fallback JSON local. */
  negocio: string;
}

export class ResilientProvider implements ILLMProvider {
  readonly model: string;

  constructor(
    private readonly providers: ILLMProvider[],
    private readonly usage?: UsageContext,
  ) {
    if (providers.length === 0) {
      throw new Error("ResilientProvider necesita al menos un proveedor");
    }
    const [first, ...rest] = providers;
    const restNames = rest.map((p) => p.model ?? "?").join(", ");
    this.model = restNames ? `${first.model} (+${restNames})` : (first.model ?? "?");
  }

  /** Nunca lanza: un fallo al registrar telemetría no puede romper la respuesta real. */
  private async registrar(proveedor: string, llamadas: number, fallbacks = 0): Promise<void> {
    if (!this.usage) return;
    try {
      await this.usage.repo.registrar({
        negocio: this.usage.negocio,
        proveedor,
        llamadas,
        fallbacks,
      });
    } catch (err) {
      console.error("[AI] no se pudo registrar el uso en uso_ia:", err);
    }
  }

  async enhance(ctx: LLMContext): Promise<string> {
    for (const provider of this.providers) {
      try {
        const result = await provider.enhance(ctx);
        await this.registrar(provider.model ?? "?", 1);
        return result;
      } catch (err) {
        await this.registrar(provider.model ?? "?", 1);
        console.error(
          `[AI] ${provider.model ?? "proveedor"} falló (enhance), probando el siguiente:`,
          err,
        );
      }
    }
    await this.registrar(FALLBACK_PROVIDER, 0, 1);
    return ctx.draftResponse;
  }

  async extractDateTime(input: DateExtractionInput): Promise<string | null> {
    for (const provider of this.providers) {
      try {
        const result = await provider.extractDateTime(input);
        await this.registrar(provider.model ?? "?", 1);
        return result;
      } catch (err) {
        await this.registrar(provider.model ?? "?", 1);
        console.error(
          `[AI] ${provider.model ?? "proveedor"} falló (extractDateTime), probando el siguiente:`,
          err,
        );
      }
    }
    await this.registrar(FALLBACK_PROVIDER, 0, 1);
    return null;
  }

  async interpret(input: InterpretInput): Promise<string | null> {
    for (const provider of this.providers) {
      try {
        const result = await provider.interpret(input);
        await this.registrar(provider.model ?? "?", 1);
        return result;
      } catch (err) {
        await this.registrar(provider.model ?? "?", 1);
        console.error(
          `[AI] ${provider.model ?? "proveedor"} falló (interpret), probando el siguiente:`,
          err,
        );
      }
    }
    await this.registrar(FALLBACK_PROVIDER, 0, 1);
    return null;
  }

  /**
   * A diferencia de interpret()/extractDateTime() (donde un `null` es una
   * respuesta VÁLIDA de negocio), acá un `null` significa que el modelo NO
   * devolvió un JSON válido — eso no es una respuesta real, así que SÍ se
   * prueba el siguiente proveedor de la cadena.
   */
  async runAgent(input: AgentTurnInput): Promise<AgentResponse | null> {
    for (const provider of this.providers) {
      try {
        const result = await provider.runAgent(input);
        await this.registrar(provider.model ?? "?", 1);
        if (result) return result;
        console.error(
          `[AI] ${provider.model ?? "proveedor"} devolvió un JSON inválido en runAgent, probando el siguiente`,
        );
      } catch (err) {
        await this.registrar(provider.model ?? "?", 1);
        console.error(
          `[AI] ${provider.model ?? "proveedor"} falló (runAgent), probando el siguiente:`,
          err,
        );
      }
    }
    await this.registrar(FALLBACK_PROVIDER, 0, 1);
    return null;
  }
}
