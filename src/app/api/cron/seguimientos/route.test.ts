import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/storage/adapters/supabase/api", () => ({ createSupabaseDb: vi.fn(() => null) }));

const { POST } = await import("@/app/api/cron/seguimientos/route");

const pedir = (auth?: string) =>
  POST(new Request("https://soyaurela.com/api/cron/seguimientos", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  }));

describe("POST /api/cron/seguimientos (T-106)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sin CRON_SECRET configurado responde 503 (no queda abierta por olvido)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await pedir("Bearer algo")).status).toBe(503);
  });

  it("sin el secreto, o con uno equivocado, responde 401", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-prueba");
    expect((await pedir()).status).toBe(401);
    expect((await pedir("Bearer otro")).status).toBe(401);
    expect((await pedir("secreto-largo-de-prueba")).status).toBe(401);
  });

  it("con el secreto correcto corre (sin base no manda nada)", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-prueba");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
    const res = await pedir("Bearer secreto-largo-de-prueba");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, enviados: 0 });
  });
});
