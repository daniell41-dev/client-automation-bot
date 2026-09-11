import { describe, expect, it } from "vitest";
import { SessionMemoryRepository } from "@/core/storage/adapters/session-memory";
import type { SessionMemory } from "@/core/types";

describe("SessionMemoryRepository", () => {
  it("crea una sesión vacía cuando el contacto no existe", async () => {
    const repo = new SessionMemoryRepository();
    const session = await repo.getOrCreate("estetica-bella", "57300000000", "mock");
    expect(session.history).toEqual([]);
    expect(session.contact).toBe("57300000000");
    expect(session.businessSlug).toBe("estetica-bella");
    expect(session.channel).toBe("mock");
  });

  it("devuelve la sesión guardada dentro de la misma instancia", async () => {
    const repo = new SessionMemoryRepository();
    const session: SessionMemory = {
      contact: "57300000000",
      businessSlug: "estetica-bella",
      channel: "mock",
      history: [{ role: "user", text: "Me llamo Daniela", timestamp: "" }],
      updatedAt: "",
    };
    await repo.save(session);
    const loaded = await repo.getOrCreate("estetica-bella", "57300000000", "mock");
    expect(loaded.history).toHaveLength(1);
    expect(loaded.history[0].text).toBe("Me llamo Daniela");
  });

  it("NO comparte estado entre instancias distintas (efímero entre runs)", async () => {
    const repoA = new SessionMemoryRepository();
    await repoA.save({
      contact: "57300000000",
      businessSlug: "estetica-bella",
      channel: "mock",
      history: [{ role: "user", text: "Me llamo Daniela", timestamp: "" }],
      updatedAt: "",
    });

    // Una nueva instancia simula una nueva ejecución del simulador: arranca limpia.
    const repoB = new SessionMemoryRepository();
    const session = await repoB.getOrCreate("estetica-bella", "57300000000", "mock");
    expect(session.history).toEqual([]);
  });
});
