/**
 * T-12: igual que `backoffice/actions.test.ts` — `guardarConfigParcial` ya
 * validaba con `parseBusinessConfig` (que ahora usa los mismos
 * `servicesSchema`/`personaSchema` que exporta `core/config-schema.ts` para
 * el cliente). Este test prueba que un patch inválido — como si alguien se
 * saltara el editor del portal y mandara el FormData directo — se rechaza
 * igual, sin llegar a escribir en la base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { esteticaBella } from "@/businesses/estetica-bella/config";

const { getUserRoleMock, createUserClientMock } = vi.hoisted(() => ({
  getUserRoleMock: vi.fn(),
  createUserClientMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getUserRole: getUserRoleMock,
  createUserClient: createUserClientMock,
}));

import { guardarConfigParcial } from "@/app/portal/actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Fake mínimo: solo lo que `guardarConfigParcial` toca ANTES de validar el patch. */
function fakeSupabaseConConfig(config: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { config } }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  getUserRoleMock.mockReset();
  createUserClientMock.mockReset();
  getUserRoleMock.mockResolvedValue({ userId: "u1", email: "c@c.com", role: "cliente" });
});

describe("guardarConfigParcial — rechaza un patch inválido sin escribir en la base", () => {
  it("catálogo vacío (viola servicesSchema)", async () => {
    createUserClientMock.mockResolvedValue(fakeSupabaseConConfig(esteticaBella));

    const result = await guardarConfigParcial(
      {},
      formData({
        slug: "estetica-bella",
        patch: JSON.stringify({ services: [] }),
      }),
    );

    expect(result.error).toBeTruthy();
  });

  it("nombre del bot vacío (viola personaSchema, embebido en personas.whatsapp)", async () => {
    createUserClientMock.mockResolvedValue(fakeSupabaseConConfig(esteticaBella));

    const result = await guardarConfigParcial(
      {},
      formData({
        slug: "estetica-bella",
        patch: JSON.stringify({
          personas: { whatsapp: { name: "", tone: "cálida", language: "es" } },
        }),
      }),
    );

    expect(result.error).toBeTruthy();
  });

  it("patch con JSON inválido", async () => {
    createUserClientMock.mockResolvedValue(fakeSupabaseConConfig(esteticaBella));

    const result = await guardarConfigParcial(
      {},
      formData({ slug: "estetica-bella", patch: "{esto no es json" }),
    );

    expect(result.error).toBe("Los cambios no son JSON válido.");
  });
});
