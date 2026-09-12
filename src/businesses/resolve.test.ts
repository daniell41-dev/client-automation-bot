import { beforeEach, describe, expect, it, vi } from "vitest";
import { esteticaBella } from "@/businesses/estetica-bella/config";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";
import { invalidateBusinessCache } from "@/businesses/business-cache";

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
  // Cada test parte de un caché limpio (T-06): sin esto, dos tests que
  // resuelven el mismo slug/phoneNumberId con fixtures distintas se pisan.
  invalidateBusinessCache();
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

describe("negocioId (T-07)", () => {
  it("viene del id de la fila cuando el negocio está en Supabase", async () => {
    const db = makeFakeSupabaseDb();
    db.negocios.push({
      id: "uuid-123",
      slug: "estetica-bella",
      config: JSON.parse(JSON.stringify(esteticaBella)),
      whatsapp_phone_number_id: null,
      es_demo: false,
    });
    createSupabaseDbMock.mockReturnValue(db);

    const resolved = await resolveBusinessBySlug("estetica-bella");
    expect(resolved?.negocioId).toBe("uuid-123");
  });

  it("queda undefined cuando el negocio viene del registry estático", async () => {
    createSupabaseDbMock.mockReturnValue(null);
    const resolved = await resolveBusinessBySlug("estetica-bella");
    expect(resolved?.negocioId).toBeUndefined();
  });
});

describe("caché de resolución (T-06)", () => {
  it("N mensajes del mismo negocio hacen 1 sola lectura a Supabase", async () => {
    const db = makeFakeSupabaseDb();
    db.negocios.push({
      slug: "estetica-bella",
      config: JSON.parse(JSON.stringify(esteticaBella)),
      whatsapp_phone_number_id: "12345",
      es_demo: false,
    });
    createSupabaseDbMock.mockReturnValue(db);
    const spy = vi.spyOn(db, "selectNegocioByPhoneNumberId");

    for (let i = 0; i < 5; i++) {
      const resolved = await resolveBusinessByPhoneNumberId("12345");
      expect(resolved?.config.slug).toBe("estetica-bella");
    }

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("guardar en el portal invalida el caché: el siguiente mensaje usa la config nueva", async () => {
    const db = makeFakeSupabaseDb();
    db.negocios.push({
      slug: "estetica-bella",
      config: JSON.parse(JSON.stringify(esteticaBella)),
      whatsapp_phone_number_id: "12345",
      es_demo: false,
    });
    createSupabaseDbMock.mockReturnValue(db);

    const antes = await resolveBusinessByPhoneNumberId("12345");
    expect(antes?.config.name).toBe("Estética Bella");

    // Simula lo que hace guardarConfigParcial()/actualizarNegocio(): escriben
    // en la tabla y después invalidan.
    db.negocios[0].config = { ...antes!.config, name: "Nuevo Nombre" };
    invalidateBusinessCache();

    const despues = await resolveBusinessByPhoneNumberId("12345");
    expect(despues?.config.name).toBe("Nuevo Nombre");
  });

  it("sin invalidar, sigue sirviendo la config vieja (así funciona el TTL de seguridad)", async () => {
    const db = makeFakeSupabaseDb();
    db.negocios.push({
      slug: "estetica-bella",
      config: JSON.parse(JSON.stringify(esteticaBella)),
      whatsapp_phone_number_id: "12345",
      es_demo: false,
    });
    createSupabaseDbMock.mockReturnValue(db);

    const antes = await resolveBusinessByPhoneNumberId("12345");
    db.negocios[0].config = { ...antes!.config, name: "Nuevo Nombre" };

    const sinInvalidar = await resolveBusinessByPhoneNumberId("12345");
    expect(sinInvalidar?.config.name).toBe("Estética Bella");
  });
});
