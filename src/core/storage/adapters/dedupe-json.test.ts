import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonMessageDedupeRepository } from "@/core/storage/adapters/dedupe-json";

let dir: string;
let filePath: string;
let repo: JsonMessageDedupeRepository;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "dedupe-"));
  filePath = join(dir, "processed-messages.json");
  repo = new JsonMessageDedupeRepository(filePath);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("JsonMessageDedupeRepository", () => {
  it("reclama un messageId nuevo (true) y no vuelve a dejarlo pasar (false)", async () => {
    expect(await repo.claim("wamid.AAA")).toBe(true);
    expect(await repo.claim("wamid.AAA")).toBe(false);
  });

  it("dos messageId distintos se reclaman de forma independiente", async () => {
    expect(await repo.claim("wamid.AAA")).toBe(true);
    expect(await repo.claim("wamid.BBB")).toBe(true);
    expect(await repo.claim("wamid.AAA")).toBe(false);
    expect(await repo.claim("wamid.BBB")).toBe(false);
  });

  it("persiste entre instancias (lee de disco)", async () => {
    await repo.claim("wamid.AAA");
    const otraInstancia = new JsonMessageDedupeRepository(filePath);
    expect(await otraInstancia.claim("wamid.AAA")).toBe(false);
  });

  it("poda entradas más viejas que 7 días al reclamar una nueva", async () => {
    await repo.claim("wamid.VIEJO");

    // Reescribe el archivo a mano con una fecha vieja, como si "wamid.VIEJO"
    // se hubiera reclamado hace más de 7 días.
    const hace10Dias = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await writeFile(filePath, JSON.stringify({ "wamid.VIEJO": hace10Dias }, null, 2), "utf8");

    await repo.claim("wamid.NUEVO");

    const raw = JSON.parse(await readFile(filePath, "utf8"));
    expect(raw).not.toHaveProperty("wamid.VIEJO");
    expect(raw).toHaveProperty("wamid.NUEVO");
  });
});
