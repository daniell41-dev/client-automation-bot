import { describe, expect, it, vi } from "vitest";
import {
  buildChatRequest,
  OpenAICompatibleProvider,
} from "@/core/ai/openai-compatible";
import type { LLMContext } from "@/core/ai/provider";

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
