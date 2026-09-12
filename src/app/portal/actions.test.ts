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

const { getUserRoleMock, createUserClientMock, revalidatePathMock } = vi.hoisted(() => ({
  getUserRoleMock: vi.fn(),
  createUserClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getUserRole: getUserRoleMock,
  createUserClient: createUserClientMock,
}));
// revalidatePath necesita un contexto real de request de Next — fuera de eso
// (como acá, en Vitest) lanza "static generation store missing".
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

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

/**
 * Fake que además soporta el `.update(...)` del camino exitoso, y expone
 * `updatedWith` para inspeccionar qué config se terminó guardando.
 */
function fakeSupabaseGuardable(config: unknown): {
  client: { from: (table: string) => unknown };
  updatedWith: () => unknown;
} {
  let ultimoUpdate: unknown;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { config } }),
        }),
      }),
      update: (payload: { config: unknown }) => {
        ultimoUpdate = payload.config;
        return {
          eq: () => ({
            select: async () => ({ data: [{ id: "negocio-1" }], error: null }),
          }),
        };
      },
    }),
  };
  return { client, updatedWith: () => ultimoUpdate };
}

beforeEach(() => {
  getUserRoleMock.mockReset();
  createUserClientMock.mockReset();
  revalidatePathMock.mockReset();
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

/**
 * T-17: el textarea "Información del negocio" (config.ai.knowledge) se movió
 * a Configuración. El editor manda el objeto `ai` COMPLETO (copia de
 * `initialAi` con solo enabled/knowledge editados) para no pisar reglas
 * rápidas ni botonesMenu que el cliente haya cargado antes desde
 * "Respuestas y flujos" (oculta, no borrada) — guardarConfigParcial
 * reemplaza la clave `ai` entera, no hace merge profundo.
 */
describe("guardarConfigParcial — ai.knowledge desde Configuración (T-17)", () => {
  const configConReglas = {
    ...JSON.parse(JSON.stringify(esteticaBella)),
    ai: {
      enabled: true,
      knowledge: "info vieja",
      reglas: [{ keywords: ["horario"], respuesta: "Abrimos de 9 a 18." }],
    },
  };

  it("persiste el knowledge nuevo y el toggle 'enabled' viaja con él", async () => {
    const { client, updatedWith } = fakeSupabaseGuardable(configConReglas);
    createUserClientMock.mockResolvedValue(client);

    const result = await guardarConfigParcial(
      {},
      formData({
        slug: "estetica-bella",
        patch: JSON.stringify({
          ai: {
            enabled: false,
            knowledge: "Aceptamos transferencia y Zelle",
            reglas: configConReglas.ai.reglas,
          },
        }),
      }),
    );

    expect(result.ok).toBeTruthy();
    const guardado = updatedWith() as { ai: typeof configConReglas.ai };
    expect(guardado.ai.knowledge).toBe("Aceptamos transferencia y Zelle");
    expect(guardado.ai.enabled).toBe(false);
  });

  it("guardar el knowledge no pisa las reglas rápidas ya configuradas", async () => {
    const { client, updatedWith } = fakeSupabaseGuardable(configConReglas);
    createUserClientMock.mockResolvedValue(client);

    await guardarConfigParcial(
      {},
      formData({
        slug: "estetica-bella",
        patch: JSON.stringify({
          ai: {
            enabled: true,
            knowledge: "Aceptamos transferencia y Zelle",
            reglas: configConReglas.ai.reglas, // el editor manda la copia completa
          },
        }),
      }),
    );

    const guardado = updatedWith() as { ai: typeof configConReglas.ai };
    expect(guardado.ai.reglas).toEqual(configConReglas.ai.reglas);
  });
});
