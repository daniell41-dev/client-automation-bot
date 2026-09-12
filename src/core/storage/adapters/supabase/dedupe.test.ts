import { describe, expect, it } from "vitest";
import { SupabaseMessageDedupeRepository } from "@/core/storage/adapters/supabase/dedupe";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";

describe("SupabaseMessageDedupeRepository", () => {
  it("reclama un messageId nuevo (true) y no vuelve a dejarlo pasar (false)", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseMessageDedupeRepository(db);

    expect(await repo.claim("wamid.AAA")).toBe(true);
    expect(await repo.claim("wamid.AAA")).toBe(false);
    expect(db.mensajesProcesados.has("wamid.AAA")).toBe(true);
  });

  it("dos messageId distintos se reclaman de forma independiente", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseMessageDedupeRepository(db);

    expect(await repo.claim("wamid.AAA")).toBe(true);
    expect(await repo.claim("wamid.BBB")).toBe(true);
    expect(await repo.claim("wamid.AAA")).toBe(false);
  });
});
