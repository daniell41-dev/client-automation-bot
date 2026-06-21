import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonLeadRepository } from "@/core/storage/adapters/json";
import type { Lead } from "@/core/types";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  const base: Lead = {
    id: "lead-1",
    businessSlug: "estetica-bella",
    channel: "mock",
    contact: "57300000000",
    name: "Laura",
    state: "interesado",
    stage: "esperando_nombre",
    createdAt: "2026-06-21T10:00:00.000Z",
    updatedAt: "2026-06-21T10:00:00.000Z",
    lastInboundAt: "2026-06-21T10:00:00.000Z",
    followUpsSent: [],
  };
  return { ...base, ...overrides };
}

let dir: string;
let repo: JsonLeadRepository;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "leads-"));
  repo = new JsonLeadRepository(join(dir, "leads.json"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("JsonLeadRepository", () => {
  it("devuelve lista vacía si el archivo no existe", async () => {
    expect(await repo.list()).toEqual([]);
    expect(await repo.findByContact("estetica-bella", "57300000000")).toBeNull();
  });

  it("guarda y recupera por contacto", async () => {
    await repo.save(makeLead());
    const found = await repo.findByContact("estetica-bella", "57300000000");
    expect(found?.id).toBe("lead-1");
    expect(found?.name).toBe("Laura");
  });

  it("hace upsert por id (no duplica)", async () => {
    await repo.save(makeLead());
    await repo.save(makeLead({ name: "Laura Pérez", state: "agendado" }));
    const all = await repo.list();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Laura Pérez");
    expect(all[0].state).toBe("agendado");
  });

  it("persiste entre instancias (lee de disco)", async () => {
    await repo.save(makeLead());
    const repo2 = new JsonLeadRepository(join(dir, "leads.json"));
    expect(await repo2.getById("lead-1")).not.toBeNull();
  });

  it("filtra por negocio y ordena por updatedAt desc", async () => {
    await repo.save(makeLead({ id: "a", updatedAt: "2026-06-21T10:00:00.000Z" }));
    await repo.save(
      makeLead({ id: "b", updatedAt: "2026-06-22T10:00:00.000Z" }),
    );
    await repo.save(
      makeLead({ id: "c", businessSlug: "otro", contact: "999" }),
    );
    const list = await repo.list("estetica-bella");
    expect(list.map((l) => l.id)).toEqual(["b", "a"]);
  });
});
