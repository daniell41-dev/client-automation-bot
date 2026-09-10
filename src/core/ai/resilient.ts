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
 */

import type {
  AgentTurnInput,
  DateExtractionInput,
  ILLMProvider,
  InterpretInput,
  LLMContext,
} from "@/core/ai/provider";
import type { AgentResponse } from "@/core/ai/agent-schema";

export class ResilientProvider implements ILLMProvider {
  readonly model: string;

  constructor(private readonly providers: ILLMProvider[]) {
    if (providers.length === 0) {
      throw new Error("ResilientProvider necesita al menos un proveedor");
    }
    const [first, ...rest] = providers;
    const restNames = rest.map((p) => p.model ?? "?").join(", ");
    this.model = restNames ? `${first.model} (+${restNames})` : (first.model ?? "?");
  }

  async enhance(ctx: LLMContext): Promise<string> {
    for (const provider of this.providers) {
      try {
        return await provider.enhance(ctx);
      } catch (err) {
        console.error(
          `[AI] ${provider.model ?? "proveedor"} falló (enhance), probando el siguiente:`,
          err,
        );
      }
    }
    return ctx.draftResponse;
  }

  async extractDateTime(input: DateExtractionInput): Promise<string | null> {
    for (const provider of this.providers) {
      try {
        return await provider.extractDateTime(input);
      } catch (err) {
        console.error(
          `[AI] ${provider.model ?? "proveedor"} falló (extractDateTime), probando el siguiente:`,
          err,
        );
      }
    }
    return null;
  }

  async interpret(input: InterpretInput): Promise<string | null> {
    for (const provider of this.providers) {
      try {
        return await provider.interpret(input);
      } catch (err) {
        console.error(
          `[AI] ${provider.model ?? "proveedor"} falló (interpret), probando el siguiente:`,
          err,
        );
      }
    }
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
        if (result) return result;
        console.error(
          `[AI] ${provider.model ?? "proveedor"} devolvió un JSON inválido en runAgent, probando el siguiente`,
        );
      } catch (err) {
        console.error(
          `[AI] ${provider.model ?? "proveedor"} falló (runAgent), probando el siguiente:`,
          err,
        );
      }
    }
    return null;
  }
}
