/**
 * T-12: la Server Action valida de nuevo con el MISMO schema que el cliente
 * — nunca confía en el formulario. Se prueba mandando un FormData inválido
 * directo a la action (como si alguien se saltara el formulario desde la
 * consola): tiene que rechazarlo con el mismo mensaje, y sin llegar a tocar
 * Supabase (la validación corta antes).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserRoleMock, createUserClientMock, redirectMock, revalidatePathMock } = vi.hoisted(
  () => ({
    getUserRoleMock: vi.fn(),
    createUserClientMock: vi.fn(),
    redirectMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
);
vi.mock("@/lib/supabase/server", () => ({
  getUserRole: getUserRoleMock,
  createUserClient: createUserClientMock,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
// revalidatePath necesita un contexto real de request de Next — fuera de
// eso (como acá, en Vitest) lanza "static generation store missing".
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import {
  actualizarNegocio,
  crearNegocio,
  eliminarNegocio,
  eliminarRubro,
  quitarAsignacion,
} from "@/app/backoffice/actions";

/** Fake mínimo: `.from(tabla).delete().eq("id", id)` resuelve a `{ error }`. */
function fakeSupabaseDelete(error: { message: string; code?: string } | null = null) {
  return {
    from: () => ({
      delete: () => ({
        eq: async () => ({ error }),
      }),
    }),
  };
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  getUserRoleMock.mockReset();
  createUserClientMock.mockReset();
  redirectMock.mockReset();
  revalidatePathMock.mockReset();
  getUserRoleMock.mockResolvedValue({ userId: "admin-1", email: "a@a.com", role: "admin" });
});

describe("crearNegocio — rechaza datos inválidos sin tocar Supabase", () => {
  it("nombre vacío", async () => {
    const result = await crearNegocio(
      {},
      formData({
        nombre: "",
        slug: "estetica-bella",
        owner_id: "u1",
        rubro_id: "r1",
        whatsapp_phone_number_id: "",
        plan: "free",
      }),
    );
    expect(result.error).toBe("El nombre es obligatorio.");
    expect(createUserClientMock).not.toHaveBeenCalled();
  });

  it("slug que no es kebab-case", async () => {
    const result = await crearNegocio(
      {},
      formData({
        nombre: "Estética Bella",
        slug: "Mi Negocio!",
        owner_id: "u1",
        rubro_id: "r1",
        whatsapp_phone_number_id: "",
        plan: "free",
      }),
    );
    expect(result.error).toContain("kebab-case");
    expect(createUserClientMock).not.toHaveBeenCalled();
  });

  it("sin cliente dueño ni rubro", async () => {
    const result = await crearNegocio(
      {},
      formData({
        nombre: "Estética Bella",
        slug: "estetica-bella",
        owner_id: "",
        rubro_id: "",
        whatsapp_phone_number_id: "",
        plan: "free",
      }),
    );
    expect(result.error).toBeTruthy();
    expect(createUserClientMock).not.toHaveBeenCalled();
  });

  it("no autenticado como admin: ni siquiera llega a validar Zod", async () => {
    getUserRoleMock.mockResolvedValueOnce({ userId: "u1", email: "c@c.com", role: "cliente" });
    const result = await crearNegocio(
      {},
      formData({
        nombre: "",
        slug: "",
        owner_id: "",
        rubro_id: "",
        whatsapp_phone_number_id: "",
        plan: "free",
      }),
    );
    expect(result.error).toBe("No autorizado.");
    expect(createUserClientMock).not.toHaveBeenCalled();
  });
});

describe("actualizarNegocio — rechaza datos inválidos sin tocar Supabase", () => {
  it("nombre vacío", async () => {
    const result = await actualizarNegocio(
      {},
      formData({
        id: "negocio-1",
        nombre: "",
        owner_id: "u1",
        whatsapp_phone_number_id: "",
        plan: "free",
      }),
    );
    expect(result.error).toBe("El nombre es obligatorio.");
    expect(createUserClientMock).not.toHaveBeenCalled();
  });

  it("sin cliente dueño", async () => {
    const result = await actualizarNegocio(
      {},
      formData({
        id: "negocio-1",
        nombre: "Estética Bella",
        owner_id: "",
        whatsapp_phone_number_id: "",
        plan: "free",
      }),
    );
    expect(result.error).toBe("Elegí un cliente dueño.");
    expect(createUserClientMock).not.toHaveBeenCalled();
  });
});

/**
 * T-13: antes estas tres actions eran `Promise<void>` sin chequear el
 * `error` de Supabase — un fallo (permisos, FK) no le llegaba a nadie.
 * Ahora devuelven `ActionState`, que es lo que `ConfirmDeleteButton` usa
 * para mostrar el toast de error.
 */
describe("eliminarNegocio", () => {
  it("no autorizado: no llega a tocar Supabase", async () => {
    getUserRoleMock.mockResolvedValueOnce({ userId: "u1", email: "c@c.com", role: "cliente" });
    const result = await eliminarNegocio({}, formData({ id: "negocio-1" }));
    expect(result.error).toBe("No autorizado.");
    expect(createUserClientMock).not.toHaveBeenCalled();
  });

  it("sin id: error, no toca Supabase", async () => {
    const result = await eliminarNegocio({}, formData({}));
    expect(result.error).toBeTruthy();
    expect(createUserClientMock).not.toHaveBeenCalled();
  });

  it("si Supabase falla, devuelve un error legible en vez de tirar sin avisar", async () => {
    createUserClientMock.mockResolvedValue(fakeSupabaseDelete({ message: "permiso denegado" }));
    const result = await eliminarNegocio({}, formData({ id: "negocio-1" }));
    expect(result.error).toBe("No se pudo eliminar: permiso denegado");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("si el borrado funciona, redirige a la lista de negocios", async () => {
    createUserClientMock.mockResolvedValue(fakeSupabaseDelete());
    await eliminarNegocio({}, formData({ id: "negocio-1" }));
    expect(redirectMock).toHaveBeenCalledWith("/backoffice/negocios");
  });
});

describe("eliminarRubro", () => {
  it("una violación de FK (23503) se traduce a un mensaje legible", async () => {
    createUserClientMock.mockResolvedValue(
      fakeSupabaseDelete({ message: "update or delete on table...", code: "23503" }),
    );
    const result = await eliminarRubro({}, formData({ id: "rubro-1" }));
    expect(result.error).toBe("No se puede eliminar: todavía tiene negocios asociados.");
  });

  it("otro error de Supabase se muestra tal cual", async () => {
    createUserClientMock.mockResolvedValue(fakeSupabaseDelete({ message: "boom" }));
    const result = await eliminarRubro({}, formData({ id: "rubro-1" }));
    expect(result.error).toBe("No se pudo eliminar: boom");
  });

  it("si el borrado funciona, devuelve ok (no navega — sigue en la misma página)", async () => {
    createUserClientMock.mockResolvedValue(fakeSupabaseDelete());
    const result = await eliminarRubro({}, formData({ id: "rubro-1" }));
    expect(result.ok).toBeTruthy();
    expect(result.error).toBeUndefined();
  });
});

describe("quitarAsignacion", () => {
  it("no autorizado: no toca Supabase", async () => {
    getUserRoleMock.mockResolvedValueOnce({ userId: "u1", email: "c@c.com", role: "cliente" });
    const result = await quitarAsignacion({}, formData({ id: "asig-1" }));
    expect(result.error).toBe("No autorizado.");
    expect(createUserClientMock).not.toHaveBeenCalled();
  });

  it("si el borrado funciona, devuelve ok", async () => {
    createUserClientMock.mockResolvedValue(fakeSupabaseDelete());
    const result = await quitarAsignacion({}, formData({ id: "asig-1" }));
    expect(result.ok).toBeTruthy();
  });
});
