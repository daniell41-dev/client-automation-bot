import { describe, expect, it } from "vitest";
import { AI_PRESETS, type AIPreset } from "@/core/ai/presets";

/** `as const` estrecha cada preset a solo sus claves presentes; acá se quiere
 *  leer `supportsVision` aunque el preset no lo declare (default `false`). */
function preset(name: keyof typeof AI_PRESETS): AIPreset {
  return AI_PRESETS[name];
}

describe("AI_PRESETS — supportsVision (T-23.3)", () => {
  it("Gemini ve imágenes", () => {
    expect(preset("gemini").supportsVision).toBe(true);
  });

  it("Groq (texto) y Cerebras NO ven imágenes", () => {
    expect(preset("groq").supportsVision).toBeFalsy();
    expect(preset("cerebras").supportsVision).toBeFalsy();
  });

  it("groq-vision usa Llama 4 Scout y ve imágenes", () => {
    expect(preset("groq-vision").supportsVision).toBe(true);
    expect(preset("groq-vision").defaultModel).toBe(
      "meta-llama/llama-4-scout-17b-16e-instruct",
    );
  });
});
