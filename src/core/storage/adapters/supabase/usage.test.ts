import { describe, expect, it } from "vitest";
import { SupabaseAiUsageRepository } from "@/core/storage/adapters/supabase/usage";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";

describe("SupabaseAiUsageRepository", () => {
  it("acumula llamadas de un mismo negocio+proveedor en vez de pisarlas", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseAiUsageRepository(db);

    await repo.registrar({ negocio: "neg-1", proveedor: "gemini", llamadas: 1 });
    await repo.registrar({ negocio: "neg-1", proveedor: "gemini", llamadas: 1 });

    expect(db.usoIa).toEqual([
      { negocio_id: "neg-1", proveedor: "gemini", llamadas: 2, tokens_in: 0, tokens_out: 0, fallbacks: 0 },
    ]);
  });

  it("negocio y proveedor distintos son filas independientes", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseAiUsageRepository(db);

    await repo.registrar({ negocio: "neg-1", proveedor: "gemini", llamadas: 1 });
    await repo.registrar({ negocio: "neg-1", proveedor: "groq", llamadas: 1 });
    await repo.registrar({ negocio: "neg-2", proveedor: "gemini", llamadas: 1 });

    expect(db.usoIa).toHaveLength(3);
  });

  it("registra fallbacks y tokens por separado de las llamadas", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseAiUsageRepository(db);

    await repo.registrar({ negocio: "neg-1", proveedor: "gemini", llamadas: 1, tokensIn: 100, tokensOut: 40 });
    await repo.registrar({ negocio: "neg-1", proveedor: "fallback_plantilla", fallbacks: 1 });

    expect(db.usoIa).toEqual([
      { negocio_id: "neg-1", proveedor: "gemini", llamadas: 1, tokens_in: 100, tokens_out: 40, fallbacks: 0 },
      { negocio_id: "neg-1", proveedor: "fallback_plantilla", llamadas: 0, tokens_in: 0, tokens_out: 0, fallbacks: 1 },
    ]);
  });
});
