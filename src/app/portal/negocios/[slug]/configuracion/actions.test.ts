/**
 * T-112: "Enviarme una prueba" del seguimiento. Lo que importa probar: solo
 * la dueña del negocio, solo a su número de Notificaciones guardado, con el
 * texto del cuadro aunque no esté guardado, y una vez cada 30 s.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUserRole: vi.fn(),
  createUserClient: vi.fn(),
  resolve: vi.fn(),
  findByContact: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getUserRole: m.getUserRole, createUserClient: m.createUserClient }));
vi.mock("@/businesses/resolve", () => ({ resolveBusinessBySlug: m.resolve }));
vi.mock("@/core/storage/factory", () => ({
  createLeadRepository: () => ({ findByContact: m.findByContact }),
  createWhatsAppUsageRepository: () => ({}),
}));
vi.mock("@/core/channels/whatsapp/send", () => ({
  WhatsAppChannel: class {
    send = m.send;
  },
}));

import { probarSeguimiento } from "./actions";

const config = {
  slug: "sabores",
  name: "Sabores",
  currency: "COP",
  notifyPhoneNumber: "+57 300 111 2233",
  services: [{ id: "bandeja", name: "Bandeja", description: "", price: 20000 }],
};

function fd(slug: string, primero = ""): FormData {
  const f = new FormData();
  f.set("slug", slug);
  f.set("primero", primero);
  return f;
}

function negocioPropio(existe: boolean) {
  m.createUserClient.mockResolvedValue({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existe ? { id: "n1" } : null }) }) }) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WHATSAPP_ACCESS_TOKEN = "token";
  m.getUserRole.mockResolvedValue({ userId: "u1", role: "cliente" });
  m.resolve.mockResolvedValue({ config, negocioId: "n1", whatsappPhoneNumberId: "pn1", esDemo: false });
  m.findByContact.mockResolvedValue(null);
  m.send.mockResolvedValue(undefined);
});

describe("probarSeguimiento", () => {
  it("manda el texto del cuadro (sin guardar) al número de Notificaciones, solo con dígitos", async () => {
    negocioPropio(true);
    const r = await probarSeguimiento({}, fd("sabores-1", "Hola{{nombre}}, ¿retomamos {{pedido}}?"));
    expect(r.ok).toBeTruthy();
    expect(m.send).toHaveBeenCalledWith({ to: "573001112233", text: "Hola Carlos, ¿retomamos 2 Bandeja?" });
  });

  it("un negocio que no es de la dueña no manda nada", async () => {
    negocioPropio(false);
    const r = await probarSeguimiento({}, fd("ajeno"));
    expect(r.error).toBeTruthy();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sin número de Notificaciones guardado, le dice dónde ponerlo", async () => {
    negocioPropio(true);
    m.resolve.mockResolvedValue({ config: { ...config, notifyPhoneNumber: undefined }, negocioId: "n1", whatsappPhoneNumberId: "pn1" });
    const r = await probarSeguimiento({}, fd("sabores-2"));
    expect(r.error).toContain("Notificaciones");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("dos clics seguidos mandan una sola prueba", async () => {
    negocioPropio(true);
    await probarSeguimiento({}, fd("sabores-3"));
    const r = await probarSeguimiento({}, fd("sabores-3"));
    expect(r.error).toContain("hace un momento");
    expect(m.send).toHaveBeenCalledTimes(1);
  });
});
