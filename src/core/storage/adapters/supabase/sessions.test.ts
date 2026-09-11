import { describe, expect, it } from "vitest";
import { SupabaseSessionRepository } from "@/core/storage/adapters/supabase/sessions";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";
import type { SessionMemory } from "@/core/types";

describe("SupabaseSessionRepository", () => {
  it("getOrCreate devuelve sesión vacía cuando no existe", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseSessionRepository(db);

    const session = await repo.getOrCreate("estetica-bella", "57300", "whatsapp");
    expect(session.history).toEqual([]);
    expect(session.contact).toBe("57300");
  });

  it("persiste el historial y lo recupera (memoria entre escrituras)", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseSessionRepository(db);

    const session: SessionMemory = {
      businessSlug: "estetica-bella",
      contact: "57300",
      channel: "whatsapp",
      history: [
        { role: "user", text: "Hola", timestamp: "t1" },
        { role: "assistant", text: "¡Hola! Soy Isabella.", timestamp: "t2" },
      ],
      updatedAt: "t2",
    };
    await repo.save(session);

    const restored = await repo.getOrCreate("estetica-bella", "57300", "whatsapp");
    expect(restored.history).toHaveLength(2);
    expect(restored.history[1].text).toBe("¡Hola! Soy Isabella.");
  });

  it("upsert por (negocio, contacto, canal): no duplica filas", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseSessionRepository(db);
    const base: SessionMemory = {
      businessSlug: "estetica-bella",
      contact: "57300",
      channel: "whatsapp",
      history: [{ role: "user", text: "Hola", timestamp: "t1" }],
      updatedAt: "t1",
    };
    await repo.save(base);
    await repo.save({
      ...base,
      history: [...base.history, { role: "user", text: "uñas", timestamp: "t2" }],
    });

    expect(db.sesiones).toHaveLength(1);
    const restored = await repo.getOrCreate("estetica-bella", "57300", "whatsapp");
    expect(restored.history).toHaveLength(2);
  });

  it("recorta el historial a los últimos 10 turnos al guardar", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseSessionRepository(db);
    const history = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      text: `msg-${i}`,
      timestamp: `t${i}`,
    }));
    await repo.save({
      businessSlug: "estetica-bella",
      contact: "57300",
      channel: "whatsapp",
      history,
      updatedAt: "t",
    });

    const restored = await repo.getOrCreate("estetica-bella", "57300", "whatsapp");
    expect(restored.history).toHaveLength(10);
    expect(restored.history[0].text).toBe("msg-5");
  });
});

describe("SupabaseSessionRepository — negocio_id (T-08)", () => {
  const session: SessionMemory = {
    businessSlug: "estetica-bella",
    contact: "57300",
    channel: "whatsapp",
    history: [],
    updatedAt: "t1",
  };

  it("completa negocio_id cuando el repo se construye con uno", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseSessionRepository(db, "uuid-negocio-1");

    await repo.save(session);

    expect(db.sesiones[0].negocio_id).toBe("uuid-negocio-1");
  });

  it("sin negocioId (negocio del registry estático), queda null", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseSessionRepository(db);

    await repo.save(session);

    expect(db.sesiones[0].negocio_id).toBeNull();
  });
});
