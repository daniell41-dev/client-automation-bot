import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const adminMock = vi.mocked(createAdminClient);
const { GET } = await import("@/app/api/health/route");

/** Cliente falso: `select(...).limit(...).abortSignal(...)` resuelve con `resultado`. */
function clienteQueResponde(resultado: Promise<{ error: unknown }>) {
  const query = { select: () => query, limit: () => query, abortSignal: () => resultado };
  return { from: () => query } as unknown as ReturnType<typeof createAdminClient>;
}

describe("GET /api/health (T-65)", () => {
  beforeEach(() => adminMock.mockReset());

  it("200 cuando la base responde", async () => {
    adminMock.mockReturnValue(clienteQueResponde(Promise.resolve({ error: null })));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, base: "ok" });
  });

  it("503 cuando la base devuelve error o no contesta a tiempo", async () => {
    adminMock.mockReturnValue(clienteQueResponde(Promise.resolve({ error: { message: "timeout" } })));
    expect((await GET()).status).toBe(503);
    adminMock.mockReturnValue(clienteQueResponde(Promise.reject(new Error("abort"))));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, base: "caída" });
  });

  it("sin Supabase configurado (modo local) responde 200", async () => {
    adminMock.mockReturnValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, base: "sin configurar" });
  });
});
