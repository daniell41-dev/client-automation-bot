import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonAiUsageRepository } from "@/core/storage/adapters/usage-json";

describe("JsonAiUsageRepository", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "usage-json-test-"));
    filePath = join(dir, "uso-ia.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("acumula llamadas del mismo negocio+proveedor en el mismo día", async () => {
    const repo = new JsonAiUsageRepository(filePath);

    await repo.registrar({ negocio: "estetica-bella", proveedor: "gemini", llamadas: 1 });
    await repo.registrar({ negocio: "estetica-bella", proveedor: "gemini", llamadas: 1 });

    const map = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(filePath, "utf8")));
    const key = Object.keys(map)[0];
    expect(map[key].llamadas).toBe(2);
  });

  it("persiste entre instancias (mismo archivo)", async () => {
    await new JsonAiUsageRepository(filePath).registrar({
      negocio: "estetica-bella",
      proveedor: "groq",
      llamadas: 1,
      tokensIn: 50,
      tokensOut: 20,
    });

    const repo2 = new JsonAiUsageRepository(filePath);
    await repo2.registrar({ negocio: "estetica-bella", proveedor: "groq", fallbacks: 1 });

    const fs = await import("node:fs/promises");
    const map = JSON.parse(await fs.readFile(filePath, "utf8"));
    const key = Object.keys(map)[0];
    expect(map[key]).toEqual({ llamadas: 1, tokensIn: 50, tokensOut: 20, fallbacks: 1 });
  });

  it("crea el directorio si no existe", async () => {
    const anidado = join(dir, "sub", "otra", "uso-ia.json");
    const repo = new JsonAiUsageRepository(anidado);

    await expect(
      repo.registrar({ negocio: "x", proveedor: "gemini", llamadas: 1 }),
    ).resolves.not.toThrow();
  });
});
