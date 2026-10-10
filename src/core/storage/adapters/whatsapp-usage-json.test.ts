import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonWhatsAppUsageRepository } from "@/core/storage/adapters/whatsapp-usage-json";

describe("JsonWhatsAppUsageRepository", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "uso-whatsapp-test-"));
    filePath = join(dir, "sub", "uso-whatsapp.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("acumula por negocio y mes, cada contador por separado", async () => {
    const repo = new JsonWhatsAppUsageRepository(filePath, () => new Date("2026-10-10T12:00:00Z"));
    await repo.registrar({ negocio: "uñas", recibidos: 1 });
    await repo.registrar({ negocio: "uñas", enviados: 1 });
    await repo.registrar({ negocio: "uñas", enviados: 1, plantillas: 0 });
    await repo.registrar({ negocio: "uñas", plantillas: 1 });

    const map = JSON.parse(await readFile(filePath, "utf8"));
    expect(map).toEqual({ "uñas|2026-10-01": { recibidos: 1, enviados: 2, plantillas: 1 } });
  });

  it("un mes nuevo arranca de cero", async () => {
    await new JsonWhatsAppUsageRepository(filePath, () => new Date("2026-10-10T12:00:00Z")).registrar({
      negocio: "uñas",
      enviados: 3,
    });
    await new JsonWhatsAppUsageRepository(filePath, () => new Date("2026-11-10T12:00:00Z")).registrar({
      negocio: "uñas",
      enviados: 1,
    });

    const map = JSON.parse(await readFile(filePath, "utf8"));
    expect(map["uñas|2026-11-01"].enviados).toBe(1);
    expect(map["uñas|2026-10-01"].enviados).toBe(3);
  });
});
