import { describe, expect, it } from "vitest";
import { SupabaseWhatsAppUsageRepository } from "@/core/storage/adapters/supabase/whatsapp-usage";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";

describe("SupabaseWhatsAppUsageRepository", () => {
  it("acumula los contadores del negocio en vez de pisarlos", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseWhatsAppUsageRepository(db);

    await repo.registrar({ negocio: "neg-1", recibidos: 1 });
    await repo.registrar({ negocio: "neg-1", enviados: 1 });
    await repo.registrar({ negocio: "neg-1", plantillas: 1 });
    await repo.registrar({ negocio: "neg-2", enviados: 1 });

    expect(db.usoWhatsapp).toEqual([
      { negocio_id: "neg-1", recibidos: 1, enviados: 1, plantillas: 1 },
      { negocio_id: "neg-2", recibidos: 0, enviados: 1, plantillas: 0 },
    ]);
  });
});
