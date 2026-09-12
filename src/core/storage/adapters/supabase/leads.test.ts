import { describe, expect, it } from "vitest";
import { SupabaseLeadRepository } from "@/core/storage/adapters/supabase/leads";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";
import type { Lead } from "@/core/types";

function makeLead(over: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    businessSlug: "estetica-bella",
    channel: "whatsapp",
    contact: "57300",
    name: "Ana",
    serviceId: "unas",
    tentativeDate: "el viernes",
    state: "interesado",
    stage: "esperando_confirmacion",
    createdAt: "2026-07-11T10:00:00.000Z",
    updatedAt: "2026-07-11T10:00:00.000Z",
    lastInboundAt: "2026-07-11T10:00:00.000Z",
    followUpsSent: ["2h"],
    notes: undefined,
    ...over,
  };
}

describe("SupabaseLeadRepository", () => {
  it("guarda un lead y lo recupera mapeando snake_case ↔ camelCase", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseLeadRepository(db);

    await repo.save(makeLead());

    expect(db.leads).toHaveLength(1);
    expect(db.leads[0].business_slug).toBe("estetica-bella");
    expect(db.leads[0].tentative_date).toBe("el viernes");

    const found = await repo.findByContact("estetica-bella", "57300");
    expect(found?.name).toBe("Ana");
    expect(found?.tentativeDate).toBe("el viernes");
    expect(found?.followUpsSent).toEqual(["2h"]);
  });

  it("hace upsert por id: actualiza sin duplicar", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseLeadRepository(db);
    await repo.save(makeLead());

    await repo.save(makeLead({ state: "agendado", stage: "datos_completos" }));

    expect(db.leads).toHaveLength(1);
    const updated = await repo.getById("lead-1");
    expect(updated?.state).toBe("agendado");
  });

  it("los campos opcionales viajan como null y vuelven como undefined", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseLeadRepository(db);
    await repo.save(makeLead({ name: undefined, serviceId: undefined, tentativeDate: undefined }));

    expect(db.leads[0].name).toBeNull();
    const found = await repo.getById("lead-1");
    expect(found?.name).toBeUndefined();
    expect(found?.serviceId).toBeUndefined();
  });

  it("list filtra por negocio y ordena por updated_at desc", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseLeadRepository(db);
    await repo.save(makeLead({ id: "a", contact: "1", updatedAt: "2026-07-11T09:00:00.000Z" }));
    await repo.save(makeLead({ id: "b", contact: "2", updatedAt: "2026-07-11T11:00:00.000Z" }));
    await repo.save(makeLead({ id: "c", contact: "3", businessSlug: "otro" }));

    const list = await repo.list("estetica-bella");
    expect(list.map((l) => l.id)).toEqual(["b", "a"]);
  });
});

describe("SupabaseLeadRepository — negocio_id (T-08)", () => {
  it("completa negocio_id cuando el repo se construye con uno", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseLeadRepository(db, "uuid-negocio-1");

    await repo.save(makeLead());

    expect(db.leads[0].negocio_id).toBe("uuid-negocio-1");
  });

  it("sin negocioId (negocio del registry estático), queda null", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseLeadRepository(db);

    await repo.save(makeLead());

    expect(db.leads[0].negocio_id).toBeNull();
  });
});
