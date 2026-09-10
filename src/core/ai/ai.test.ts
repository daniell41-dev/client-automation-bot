import { afterEach, describe, expect, it } from "vitest";
import { createLLMProvider } from "@/core/ai/factory";
import { buildSystemPrompt, buildUserMessage } from "@/core/ai/prompt";
import type { LLMContext } from "@/core/ai/provider";

const ctx: LLMContext = {
  businessName: "Estética Bella",
  persona: { name: "Isabella", tone: "cálida", language: "español colombiano" },
  history: [{ role: "user", text: "Hola", timestamp: "" }],
  draftResponse: "Limpieza facial. Precio: $120.000. Duración: 60 minutos.",
  stage: "info_enviada",
};

/** Variables de entorno de IA relevantes, para limpiar entre tests. */
const AI_ENV_VARS = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "CEREBRAS_API_KEY",
  "CEREBRAS_MODEL",
  "AI_CUSTOM_API_KEY",
  "AI_CUSTOM_BASE_URL",
  "AI_CUSTOM_MODEL",
  "AI_PROVIDER_ORDER",
] as const;

describe("createLLMProvider", () => {
  const originals = Object.fromEntries(
    AI_ENV_VARS.map((key) => [key, process.env[key]]),
  );
  afterEach(() => {
    for (const key of AI_ENV_VARS) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });

  it("devuelve null cuando no hay ninguna key de IA configurada", () => {
    expect(createLLMProvider()).toBeNull();
  });

  it("crea un provider Gemini con el modelo por defecto", () => {
    process.env.GEMINI_API_KEY = "test-key";
    const provider = createLLMProvider();
    expect(provider).not.toBeNull();
    expect(provider?.model).toBe("gemini-3.5-flash-lite");
  });

  it("sigue funcionando solo con GROQ_API_KEY (compatibilidad hacia atrás)", () => {
    process.env.GROQ_API_KEY = "test-key";
    const provider = createLLMProvider();
    expect(provider?.model).toBe("openai/gpt-oss-20b");
  });

  it("respeta *_MODEL si se especifica", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-custom";
    expect(createLLMProvider()?.model).toBe("gemini-custom");
  });

  it("arma una cadena de respaldo cuando hay varias keys (orden: gemini -> groq)", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    const provider = createLLMProvider();
    expect(provider?.model).toBe("gemini-3.5-flash-lite (+openai/gpt-oss-20b)");
  });

  it("AI_PROVIDER_ORDER reordena la cadena", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    process.env.AI_PROVIDER_ORDER = "groq,gemini";
    const provider = createLLMProvider();
    expect(provider?.model).toBe("openai/gpt-oss-20b (+gemini-3.5-flash-lite)");
  });

  it("arma un provider custom (Ollama u otro) desde AI_CUSTOM_*", () => {
    process.env.AI_CUSTOM_API_KEY = "custom-key";
    process.env.AI_CUSTOM_BASE_URL = "http://localhost:11434/v1";
    process.env.AI_CUSTOM_MODEL = "llama3";
    expect(createLLMProvider()?.model).toBe("llama3");
  });

  it("ignora AI_CUSTOM_* si falta alguna de las tres variables", () => {
    process.env.AI_CUSTOM_API_KEY = "custom-key";
    // Faltan AI_CUSTOM_BASE_URL y AI_CUSTOM_MODEL.
    expect(createLLMProvider()).toBeNull();
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
