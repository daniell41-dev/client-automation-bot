/**
 * Cadena de respaldo entre proveedores de IA.
 *
 * Envuelve una lista ordenada de `ILLMProvider` (p. ej. Gemini -> Groq ->
 * Cerebras): prueba el primero, y si LANZA (red, HTTP, timeout) pasa al
 * siguiente. Si todos fallan, `enhance` devuelve el borrador del motor y
 * `extractDateTime` devuelve `null` — igual que el comportamiento original
 * de `GroqProvider` sin conexión, así el bot nunca se cae por la IA.
 *
 * Un `null` de `extractDateTime` que SÍ devuelve un proveedor (fecha
 * ambigua, no un error) es una respuesta válida: no dispara el fallback.
 */

import type {
  DateExtractionInput,
  ILLMProvider,
  InterpretInput,
  LLMContext,
} from "@/core/ai/provider";

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
}
