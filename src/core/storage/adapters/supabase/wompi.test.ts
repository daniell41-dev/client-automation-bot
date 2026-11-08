import { describe, expect, it } from "vitest";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";

describe("SupabaseDb.selectWompiCredentials (T-24.5)", () => {
  it("devuelve las llaves seedeadas para un negocio", async () => {
    const db = makeFakeSupabaseDb();
    db.wompiCredenciales.set("neg-1", {
      publicKey: "pub_test_123",
      integritySecret: "secreto-integridad",
      eventsSecret: "secreto-eventos",
    });

    expect(await db.selectWompiCredentials("neg-1")).toEqual({
      publicKey: "pub_test_123",
      integritySecret: "secreto-integridad",
      eventsSecret: "secreto-eventos",
    });
  });

  it("sin llaves seedeadas para el negocio, devuelve null", async () => {
    const db = makeFakeSupabaseDb();
    expect(await db.selectWompiCredentials("neg-sin-wompi")).toBeNull();
  });

  it("negocios distintos no comparten llaves", async () => {
    const db = makeFakeSupabaseDb();
    db.wompiCredenciales.set("neg-1", {
      publicKey: "pub_1",
      integritySecret: "int_1",
      eventsSecret: "ev_1",
    });

    expect(await db.selectWompiCredentials("neg-2")).toBeNull();
  });
});
