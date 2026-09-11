import { describe, expect, it } from "vitest";
import { buildRulesBlock } from "@/core/ai/rules";
import type { LLMContext } from "@/core/ai/provider";

const base: LLMContext = {
  businessName: "Estética Bella",
  persona: { name: "Isabella", tone: "cálida", language: "español colombiano" },
  history: [{ role: "user", text: "Hola", timestamp: "" }],
  draftResponse: "Para ayudarte mejor, ¿cuál es tu nombre?",
  stage: "esperando_nombre",
};

const enCurso: LLMContext = {
  ...base,
  history: [
    { role: "user", text: "Hola", timestamp: "" },
    { role: "assistant", text: "¡Hola! Soy Isabella.", timestamp: "" },
    { role: "user", text: "limpieza facial", timestamp: "" },
  ],
};

describe("buildRulesBlock", () => {
  it("al inicio incluye la regla de pedir el nombre carismáticamente y NO la de no-resaludar", () => {
    const block = buildRulesBlock(base);
    expect(block).toMatch(/cálida y carismática/i);
    expect(block).not.toMatch(/NO vuelvas a saludar/i);
  });

  it("con la conversación en curso incluye no-resaludar y NO la de pedir el nombre", () => {
    const block = buildRulesBlock(enCurso);
    expect(block).toMatch(/NO vuelvas a saludar/i);
    expect(block).not.toMatch(/cálida y carismática/i);
  });

  it("siempre incluye la regla de contexto de 'gracias'", () => {
    expect(buildRulesBlock(base)).toMatch(/gracias/i);
    expect(buildRulesBlock(enCurso)).toMatch(/gracias/i);
  });

  it("numera las reglas de forma contigua (1..N) tras filtrar las condicionales", () => {
    const block = buildRulesBlock(base);
    const numbers = [...block.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual([...Array(numbers.length)].map((_, i) => i + 1));
  });

  it("instruye a NUNCA reemplazar un dato raro del borrador por uno inventado", () => {
    const block = buildRulesBlock(base);
    expect(block).toMatch(/NUNCA lo reemplaces/i);
    expect(block).toMatch(/inventar un dato/i);
  });
});
