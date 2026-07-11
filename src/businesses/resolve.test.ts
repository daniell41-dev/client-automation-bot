import { beforeEach, describe, expect, it, vi } from "vitest";
import { esteticaBella } from "@/businesses/estetica-bella/config";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";

// Controla lo que devuelve createSupabaseDb() en cada test.
const { createSupabaseDbMock } = vi.hoisted(() => ({
  createSupabaseDbMock: vi.fn(),
}));
vi.mock("@/core/storage/adapters/supabase/api", () => ({
  createSupabaseDb: createSupabaseDbMock,
}));

import {
  resolveBusinessBySlug,
  resolveBusinessByPhoneNumberId,
} from "@/businesses/resolve";

beforeEach(() => {
  createSupabaseDbMock.mockReset();
});

describe("resolveBusinessBySlug", () => {
  it("sin Supabase cae al registry estático", async () => {
    createSupabaseDbMock.mockReturnValue(null);
    const resolved = await resolveBusinessBySlug("estetica-bella");
    expect(resolved?.config.name).toBe("Estética Bella");
    expect(resolved?.esDemo).toBe(false);
  });

  it("con Supabase devuelve el negocio de la base (config JSONB válida)", async () => {
    const db = makeFakeSupabaseDb();
    const config = JSON.parse(JSON.stringify(esteticaBella));
    config.slug = "mi-spa";
    config.name = "Mi Spa";
    db.negocios.push({
      slug: "mi-spa",
      config,
      whatsapp_phone_number_id: null,
      es_demo: true,
    });
    createSupabaseDbMock.mockReturnValue(db);

    const resolved = await resolveBusinessBySlug("mi-spa");
    expect(resolved?.config.name).toBe("Mi Spa");
    expect(resolved?.esDemo).toBe(true);
  });

  it("con config inválida en la base cae al registry estático", async () => {
    const db = makeFakeSupabaseDb();
    db.negocios.push({
      slug: "estetica-bella",
      config: { esto: "no es una config" },
      whatsapp_phone_number_id: null,
      es_demo: false,
    });
    createSupabaseDbMock.mockReturnValue(db);

    const resolved = await resolveBusinessBySlug("estetica-bella");
    expect(resolved?.config.name).toBe("Estética Bella"); // vino del registry
  });

  it("devuelve null si no está ni en la base ni en el registry", async () => {
    createSupabaseDbMock.mockReturnValue(makeFakeSupabaseDb());
    expect(await resolveBusinessBySlug("no-existe")).toBeNull();
  });
});

describe("resolveBusinessByPhoneNumberId", () => {
  it("resuelve por whatsapp_phone_number_id desde la base", async () => {
    const db = makeFakeSupabaseDb();
    db.negocios.push({
      slug: "estetica-bella",
      config: JSON.parse(JSON.stringify(esteticaBella)),
      whatsapp_phone_number_id: "12345",
      es_demo: false,
    });
    createSupabaseDbMock.mockReturnValue(db);

    const resolved = await resolveBusinessByPhoneNumberId("12345");
    expect(resolved?.config.slug).toBe("estetica-bella");
  });

  it("devuelve null si el phone_number_id no está mapeado", async () => {
    createSupabaseDbMock.mockReturnValue(null);
    expect(await resolveBusinessByPhoneNumberId("99999")).toBeNull();
  });
});
