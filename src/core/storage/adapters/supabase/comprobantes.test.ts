import { describe, expect, it } from "vitest";
import { SupabaseComprobanteRepository } from "@/core/storage/adapters/supabase/comprobantes";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";

describe("SupabaseComprobanteRepository — crear", () => {
  it("inserta un comprobante nuevo en estado pendiente", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseComprobanteRepository(db);

    const comprobante = await repo.crear({
      negocio: "neg-1",
      referencia: "ABC123",
      monto: 45000,
      moneda: "COP",
      banco: "nequi",
    });

    expect(comprobante.estado).toBe("pendiente");
    expect(comprobante.id).toBeTruthy();
    expect(comprobante.referencia).toBe("ABC123");
    expect(db.comprobantes).toHaveLength(1);
  });

  it("la MISMA referencia dos veces en el MISMO negocio falla (antifraude, §1.7)", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseComprobanteRepository(db);

    await repo.crear({ negocio: "neg-1", referencia: "ABC123" });

    await expect(repo.crear({ negocio: "neg-1", referencia: "ABC123" })).rejects.toThrow();
    expect(db.comprobantes).toHaveLength(1); // el segundo insert nunca entró
  });

  it("la MISMA referencia en negocios DISTINTOS sí entra", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseComprobanteRepository(db);

    await repo.crear({ negocio: "neg-1", referencia: "ABC123" });
    await repo.crear({ negocio: "neg-2", referencia: "ABC123" });

    expect(db.comprobantes).toHaveLength(2);
  });

  it("varios comprobantes SIN referencia (ilegibles, T-24.2) no chocan entre sí", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseComprobanteRepository(db);

    await repo.crear({ negocio: "neg-1" });
    await repo.crear({ negocio: "neg-1" });

    expect(db.comprobantes).toHaveLength(2);
  });

  it("guarda leadId, monto, moneda, banco, fecha y señales tal cual", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseComprobanteRepository(db);

    const comprobante = await repo.crear({
      negocio: "neg-1",
      leadId: "lead-1",
      referencia: "REF-9",
      monto: 12000,
      moneda: "COP",
      banco: "bancolombia",
      fechaComprobante: "2026-09-15T14:00:00.000Z",
      señales: { referenciaRepetida: false },
    });

    expect(comprobante).toMatchObject({
      negocio: "neg-1",
      leadId: "lead-1",
      referencia: "REF-9",
      monto: 12000,
      moneda: "COP",
      banco: "bancolombia",
      fechaComprobante: "2026-09-15T14:00:00.000Z",
      señales: { referenciaRepetida: false },
    });
  });
});
