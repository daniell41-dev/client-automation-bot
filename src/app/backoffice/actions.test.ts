/**
 * T-12: la Server Action valida de nuevo con el MISMO schema que el cliente
 * — nunca confía en el formulario. Se prueba mandando un FormData inválido
 * directo a la action (como si alguien se saltara el formulario desde la
 * consola): tiene que rechazarlo con el mismo mensaje, y sin llegar a tocar
 * Supabase (la validación corta antes).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserRoleMock, createUserClientMock } = vi.hoisted(() => ({
  getUserRoleMock: vi.fn(),
  createUserClientMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getUserRole: getUserRoleMock,
  createUserClient: createUserClientMock,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { actualizarNegocio, crearNegocio } from "@/app/backoffice/actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  getUserRoleMock.mockReset();
  createUserClientMock.mockReset();
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
