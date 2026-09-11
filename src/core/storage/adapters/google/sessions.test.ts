import { describe, expect, it } from "vitest";
import { GoogleSheetsSessionRepository } from "@/core/storage/adapters/google/sessions";
import { makeFakeSheets } from "@/core/storage/adapters/google/fake-sheets";
import type { SessionMemory } from "@/core/types";

describe("GoogleSheetsSessionRepository", () => {
  it("getOrCreate devuelve sesión vacía cuando no existe", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsSessionRepository(sheets);

    const session = await repo.getOrCreate("estetica-bella", "57300", "whatsapp");
    expect(session.history).toEqual([]);
    expect(session.contact).toBe("57300");
  });

  it("persiste el historial y lo recupera (memoria entre escrituras)", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsSessionRepository(sheets);

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

  it("upsert por businessSlug+contact: no duplica filas", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsSessionRepository(sheets);
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

    const rows = sheets.dump("Sesiones");
    expect(rows).toHaveLength(2); // header + 1 contacto
    const restored = await repo.getOrCreate("estetica-bella", "57300", "whatsapp");
    expect(restored.history).toHaveLength(2);
  });

  it("recorta el historial a los últimos 10 turnos al guardar", async () => {
    const sheets = makeFakeSheets();
    const repo = new GoogleSheetsSessionRepository(sheets);
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
    expect(restored.history[0].text).toBe("msg-5"); // se quedan los últimos 10
  });
});
