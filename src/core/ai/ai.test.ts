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

describe("buildSystemPrompt — reglas adicionales", () => {
  it("no incluye instrucción de no-saludo cuando el historial no tiene turno assistant", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).not.toMatch(/NO vuelvas a saludar/i);
  });

  it("incluye instrucción de no-saludo cuando el historial ya tiene turno assistant", () => {
    const ctxEnCurso: LLMContext = {
      ...ctx,
      history: [
        { role: "user", text: "Hola", timestamp: "" },
        { role: "assistant", text: "¡Hola! Soy Isabella.", timestamp: "" },
      ],
    };
    expect(buildSystemPrompt(ctxEnCurso)).toMatch(/NO vuelvas a saludar/i);
  });

  it("siempre incluye instrucción de conservar menús numerados", () => {
    expect(buildSystemPrompt(ctx)).toMatch(/lista numerada|menú/i);
  });

  it("instruye a no agregar preguntas ni llamados a la acción fuera del borrador", () => {
    expect(buildSystemPrompt(ctx)).toMatch(/No agregues preguntas/i);
  });
});

describe("buildSystemPrompt — knowledge del negocio", () => {
  it("incluye la información del negocio cuando está configurada", () => {
    const prompt = buildSystemPrompt({
      ...ctx,
      knowledge: "Parrilla en el centro. Aceptamos tarjetas y hacemos envíos.",
    });
    expect(prompt).toContain("Información del negocio");
    expect(prompt).toContain("Aceptamos tarjetas");
  });

  it("no agrega el bloque cuando no hay knowledge", () => {
    expect(buildSystemPrompt(ctx)).not.toContain("Información del negocio");
  });
});
