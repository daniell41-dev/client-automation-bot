import { describe, expect, it } from "vitest";
import { GoogleSheetsLeadRepository } from "@/core/storage/adapters/google/leads";
import { makeFakeSheets } from "@/core/storage/adapters/google/fake-sheets";
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
    createdAt: "2026-06-28T10:00:00.000Z",
    updatedAt: "2026-06-28T10:00:00.000Z",
    lastInboundAt: "2026-06-28T10:00:00.000Z",
    followUpsSent: ["2h"],
    notes: undefined,
    ...over,
  };
}

describe("GoogleSheetsLeadRepository", () => {
  it("crea la pestaña con encabezados y guarda un lead (append)", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsLeadRepository(sheets);

    await repo.save(makeLead());

    const rows = sheets.dump("Leads");
    expect(rows[0][0]).toBe("id"); // encabezado
    expect(rows).toHaveLength(2); // header + 1 lead
    expect(rows[1][4]).toBe("Ana"); // columna name
  });

  it("recupera el lead con findByContact mapeando la fila de vuelta", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsLeadRepository(sheets);
    await repo.save(makeLead());

    const found = await repo.findByContact("estetica-bella", "57300");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Ana");
    expect(found?.state).toBe("interesado");
    expect(found?.followUpsSent).toEqual(["2h"]);
  });

  it("hace upsert por id: actualiza la misma fila, no duplica", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsLeadRepository(sheets);
    await repo.save(makeLead());

    await repo.save(makeLead({ state: "agendado", stage: "datos_completos" }));

    const rows = sheets.dump("Leads");
    expect(rows).toHaveLength(2); // sigue siendo header + 1
    const updated = await repo.getById("lead-1");
    expect(updated?.state).toBe("agendado");
  });

  it("list filtra por negocio y ordena por updatedAt desc", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsLeadRepository(sheets);
    await repo.save(makeLead({ id: "a", contact: "1", updatedAt: "2026-06-28T09:00:00.000Z" }));
    await repo.save(makeLead({ id: "b", contact: "2", updatedAt: "2026-06-28T11:00:00.000Z" }));
    await repo.save(makeLead({ id: "c", contact: "3", businessSlug: "otro" }));

    const list = await repo.list("estetica-bella");
    expect(list.map((l) => l.id)).toEqual(["b", "a"]);
  });
});
