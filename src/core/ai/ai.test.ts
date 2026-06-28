import { afterEach, describe, expect, it } from "vitest";
import { createGroqProvider } from "@/core/ai/groq";
import { buildSystemPrompt, buildUserMessage } from "@/core/ai/prompt";
import type { LLMContext } from "@/core/ai/provider";

const ctx: LLMContext = {
  businessName: "Estética Bella",
  persona: { name: "Isabella", tone: "cálida", language: "español colombiano" },
  history: [{ role: "user", text: "Hola", timestamp: "" }],
  draftResponse: "Limpieza facial. Precio: $120.000. Duración: 60 minutos.",
  stage: "info_enviada",
};

describe("createGroqProvider", () => {
  const original = process.env.GROQ_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = original;
  });

  it("devuelve null cuando no hay GROQ_API_KEY", () => {
    delete process.env.GROQ_API_KEY;
    expect(createGroqProvider()).toBeNull();
  });

  it("crea un provider cuando hay key", () => {
    process.env.GROQ_API_KEY = "test-key";
    const provider = createGroqProvider();
    expect(provider).not.toBeNull();
    expect(provider?.model).toBe("llama-3.3-70b-versatile");
  });
});

describe("buildSystemPrompt", () => {
  it("incluye el nombre de la persona y del negocio", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("Isabella");
    expect(prompt).toContain("Estética Bella");
  });

  it("instruye a preservar los datos exactos (precios/duraciones)", () => {
    const prompt = buildSystemPrompt(ctx).toLowerCase();
    expect(prompt).toMatch(/precio|número|exact/);
  });
});

describe("buildUserMessage", () => {
  it("incluye el borrador a reformular", () => {
    expect(buildUserMessage(ctx)).toContain("$120.000");
  });
});
