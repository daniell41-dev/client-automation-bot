import { describe, expect, it } from "vitest";
import { buildInterpretPrompt, parseInterpretation } from "@/core/ai/interpret";

describe("buildInterpretPrompt", () => {
  it("incluye las opciones numeradas y la etapa actual", () => {
    const prompt = buildInterpretPrompt({
      options: ["Limpieza facial", "Uñas"],
      stage: "menu_enviado",
    });
    expect(prompt).toContain("1. Limpieza facial");
    expect(prompt).toContain("2. Uñas");
    expect(prompt).toContain("menu_enviado");
  });

  it("instruye a responder EXACTO una opción o NONE", () => {
    const prompt = buildInterpretPrompt({ options: ["A", "B"], stage: "x" });
    expect(prompt).toMatch(/EXACTO/);
    expect(prompt).toMatch(/NONE/);
    expect(prompt).toMatch(/NUNCA inventes/i);
  });
});

describe("parseInterpretation", () => {
  const options = ["Limpieza facial", "Uñas"];

  it("acepta el texto exacto de una opción", () => {
    expect(parseInterpretation("Uñas", options)).toBe("Uñas");
  });

  it("tolera comillas, espacios y mayúsculas/minúsculas distintas", () => {
    expect(parseInterpretation('"uñas"', options)).toBe("Uñas");
    expect(parseInterpretation("  UÑAS  ", options)).toBe("Uñas");
  });

  it("devuelve null si el modelo responde NONE", () => {
    expect(parseInterpretation("NONE", options)).toBeNull();
    expect(parseInterpretation("none", options)).toBeNull();
  });

  it("devuelve null si la respuesta está vacía", () => {
    expect(parseInterpretation("", options)).toBeNull();
    expect(parseInterpretation("   ", options)).toBeNull();
  });

  it("NUNCA acepta algo que no esté en la lista, aunque el modelo invente algo parecido", () => {
    expect(parseInterpretation("Manicure", options)).toBeNull();
    expect(parseInterpretation("Limpieza", options)).toBeNull(); // substring parcial, no exacto
  });
});
