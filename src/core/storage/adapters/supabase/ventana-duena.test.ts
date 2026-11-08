import { describe, expect, it } from "vitest";
import { SupabaseVentanaDuenaRepository } from "@/core/storage/adapters/supabase/ventana-duena";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";

describe("SupabaseVentanaDuenaRepository (T-59)", () => {
  it("guarda y devuelve el último mensaje de la dueña por negocio", async () => {
    const repo = new SupabaseVentanaDuenaRepository(makeFakeSupabaseDb());
    expect(await repo.ultimoMensaje("neg-1")).toBeUndefined();
    await repo.registrarMensaje("neg-1", new Date("2026-10-26T12:00:00Z"));
    expect(await repo.ultimoMensaje("neg-1")).toBe("2026-10-26T12:00:00.000Z");
    expect(await repo.ultimoMensaje("neg-2")).toBeUndefined();
  });
});
