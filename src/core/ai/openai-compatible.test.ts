import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildChatRequest,
  OpenAICompatibleProvider,
} from "@/core/ai/openai-compatible";
import type { AgentTurnInput, LLMContext } from "@/core/ai/provider";

const ctx: LLMContext = {
  businessName: "Estética Bella",
  persona: { name: "Isabella", tone: "cálida", language: "español colombiano" },
  history: [{ role: "user", text: "Hola", timestamp: "" }],
  draftResponse: "Limpieza facial. Precio: $120.000.",
  stage: "info_enviada",
};

describe("buildChatRequest", () => {
  it("arma la URL de chat/completions y el body con el modelo indicado", () => {
    const { url, init } = buildChatRequest(
      { baseURL: "https://api.example.com/v1", apiKey: "abc", model: "modelo-x" },
      [{ role: "user", content: "hola" }],
      { temperature: 0.5, maxTokens: 100 },
    );
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("modelo-x");
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(100);
    expect(body.messages).toEqual([{ role: "user", content: "hola" }]);
  });

  it("no duplica la barra si baseURL ya termina en /", () => {
    const { url } = buildChatRequest(
      { baseURL: "https://api.example.com/v1/", apiKey: "abc", model: "m" },
      [],
      { temperature: 0, maxTokens: 10 },
    );
    expect(url).toBe("https://api.example.com/v1/chat/completions");
  });
});

/** Fake fetch que responde un texto fijo (o falla, según el caso). */
function fakeFetchOk(content: string): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
    }),
  ) as unknown as typeof fetch;
}

function fakeFetchHttpError(status: number, body = "boom"): typeof fetch {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("OpenAICompatibleProvider.enhance", () => {
  it("devuelve el texto reformulado por el modelo", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "test",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fakeFetchOk("¡Hola! Te cuento de la limpieza facial 💜"),
    });
    const result = await provider.enhance(ctx);
    expect(result).toBe("¡Hola! Te cuento de la limpieza facial 💜");
  });

  it("lanza si la respuesta HTTP no es ok (para que la cadena de respaldo lo capture)", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "test",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fakeFetchHttpError(429, "rate limited"),
    });
    await expect(provider.enhance(ctx)).rejects.toThrow(/429/);
  });

  it("lanza si la respuesta no trae contenido", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "test",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: vi.fn(
        async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      ) as unknown as typeof fetch,
    });
    await expect(provider.enhance(ctx)).rejects.toThrow(/vacía/);
  });
});

describe("OpenAICompatibleProvider.extractDateTime", () => {
  it("parsea una fecha ISO válida devuelta por el modelo", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "test",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fakeFetchOk("2026-06-30T15:00:00-05:00"),
    });
    const result = await provider.extractDateTime({
      text: "mañana a las 3",
      nowISO: "2026-06-29T10:00:00.000Z",
      timezone: "America/Bogota",
    });
    expect(result).toBe("2026-06-30T15:00:00-05:00");
  });

  it("devuelve null (no lanza) cuando el modelo responde NONE", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "test",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fakeFetchOk("NONE"),
    });
    const result = await provider.extractDateTime({
      text: "no sé",
      nowISO: "2026-06-29T10:00:00.000Z",
      timezone: "America/Bogota",
    });
    expect(result).toBeNull();
  });

  it("sí lanza si la llamada HTTP falla (distinto de una fecha ambigua)", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "test",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fakeFetchHttpError(500),
    });
    await expect(
      provider.extractDateTime({
        text: "mañana",
        nowISO: "2026-06-29T10:00:00.000Z",
        timezone: "America/Bogota",
      }),
    ).rejects.toThrow(/500/);
  });
});

describe("buildChatRequest — modo JSON", () => {
  it("pide response_format json_object cuando jsonMode está activo", () => {
    const { init } = buildChatRequest(
      { baseURL: "https://api.example.com/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hola" }],
      { temperature: 0, maxTokens: 100, jsonMode: true },
    );
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("NO manda response_format cuando jsonMode no está activo", () => {
    const { init } = buildChatRequest(
      { baseURL: "https://api.example.com/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hola" }],
      { temperature: 0.7, maxTokens: 100 },
    );
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toBeUndefined();
  });
});

describe("buildChatRequest — reasoning_effort", () => {
  it("manda reasoning_effort cuando se especifica", () => {
    const { init } = buildChatRequest(
      { baseURL: "https://api.example.com/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hola" }],
      { temperature: 0, maxTokens: 100, reasoningEffort: "low" },
    );
    const body = JSON.parse(init.body as string);
    expect(body.reasoning_effort).toBe("low");
  });

  it("NO manda reasoning_effort si no se especifica", () => {
    const { init } = buildChatRequest(
      { baseURL: "https://api.example.com/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hola" }],
      { temperature: 0, maxTokens: 100 },
    );
    const body = JSON.parse(init.body as string);
    expect(body.reasoning_effort).toBeUndefined();
  });
});

describe("OpenAICompatibleProvider.enhance — respuesta vacía", () => {
  it("incluye el finish_reason en el error cuando la respuesta viene sin contenido", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "gemini",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: {}, finish_reason: "length" }] }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch,
    });
    await expect(provider.enhance(ctx)).rejects.toThrow(/finish_reason=length/);
  });
});

const agentInput: AgentTurnInput = {
  businessName: "Estética Bella",
  currency: "COP",
  persona: { name: "Isabella", tone: "cálida", language: "español colombiano" },
  services: [
    {
      id: "unas",
      name: "Uñas",
      description: "Manicure",
      price: 60000,
      durationMinutes: 45,
    },
  ],
  lead: { yaConfirmado: false, offTopicCount: 0 },
  history: [],
  message: "Hola",
};

describe("OpenAICompatibleProvider.runAgent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("manda reasoning_effort y maxTokens holgado, y devuelve el JSON parseado", async () => {
    let bodyVisto: Record<string, unknown> | null = null;
    const provider = new OpenAICompatibleProvider({
      name: "gemini",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      reasoningEffort: "low",
      fetchImpl: vi.fn(async (_url, init) => {
        bodyVisto = JSON.parse((init as RequestInit).body as string);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"respuesta":"hola","acciones":[]}' } }],
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });

    const result = await provider.runAgent(agentInput);

    expect(result?.respuesta).toBe("hola");
    expect(bodyVisto!.reasoning_effort).toBe("low");
    expect(bodyVisto!.max_tokens).toBe(1600);
    expect(bodyVisto!.response_format).toEqual({ type: "json_object" });
  });

  it("devuelve null y loguea el motivo cuando el modelo no devuelve JSON válido", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = new OpenAICompatibleProvider({
      name: "gemini",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fakeFetchOk("esto no es json"),
    });

    const result = await provider.runAgent(agentInput);

    expect(result).toBeNull();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("no-json"));
  });

  it("devuelve la respuesta rescatada y deja constancia en el log cuando el JSON venía roto", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = new OpenAICompatibleProvider({
      name: "gemini",
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fakeFetchOk('{"respuesta": "¡Sí, tenemos disponibilidad para maña'),
    });

    const result = await provider.runAgent(agentInput);

    expect(result?.respuesta).toBe("¡Sí, tenemos disponibilidad para maña");
    expect(result?.acciones).toEqual([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("rescató"));
  });
});
