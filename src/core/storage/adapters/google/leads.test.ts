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

describe("GoogleSheetsLeadRepository — appointmentAt/confirmedAt (T-20)", () => {
  it("guarda y recupera las dos columnas nuevas (O y P)", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsLeadRepository(sheets);
    await repo.save(
      makeLead({
        appointmentAt: "2026-07-15T20:00:00.000Z",
        confirmedAt: "2026-06-28T10:05:00.000Z",
      }),
    );

    const rows = sheets.dump("Leads");
    expect(rows[1][14]).toBe("2026-07-15T20:00:00.000Z"); // columna O
    expect(rows[1][15]).toBe("2026-06-28T10:05:00.000Z"); // columna P

    const found = await repo.getById("lead-1");
    expect(found?.appointmentAt).toBe("2026-07-15T20:00:00.000Z");
    expect(found?.confirmedAt).toBe("2026-06-28T10:05:00.000Z");
  });

  it("una fila vieja de 14 columnas (sin O/P) vuelve con ambas en undefined", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsLeadRepository(sheets);
    await repo.save(makeLead());

    // Simula una fila escrita antes de T-20: recorta a las 14 columnas viejas.
    const rows = sheets.dump("Leads");
    rows[1] = rows[1].slice(0, 14);

    const found = await repo.getById("lead-1");
    expect(found?.appointmentAt).toBeUndefined();
    expect(found?.confirmedAt).toBeUndefined();
    // El resto de la fila sigue leyéndose bien.
    expect(found?.name).toBe("Ana");
  });
});
