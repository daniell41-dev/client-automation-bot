/**
 * T-114: "Enviar ahora" del seguimiento, a un cliente con un pedido a medias.
 * Lo que importa probar: solo la dueña del negocio, solo a un cliente de ESE
 * negocio que todavía puede recibirlo, con el texto del cuadro aunque no esté
 * guardado, que quede anotado y que un doble clic no mande dos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUserRole: vi.fn(),
  createUserClient: vi.fn(),
  resolve: vi.fn(),
  getById: vi.fn(),
  saveLead: vi.fn(),
  getOrCreate: vi.fn(),
  saveSesion: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getUserRole: m.getUserRole, createUserClient: m.createUserClient }));
vi.mock("@/businesses/resolve", () => ({ resolveBusinessBySlug: m.resolve }));
vi.mock("@/core/storage/factory", () => ({
  createLeadRepository: () => ({ getById: m.getById, save: m.saveLead }),
  createSessionRepository: () => ({ getOrCreate: m.getOrCreate, save: m.saveSesion }),
  createWhatsAppUsageRepository: () => ({}),
}));
vi.mock("@/core/channels/whatsapp/send", () => ({
  WhatsAppChannel: class {
    send = m.send;
  },
}));

import { enviarSeguimientoAhora } from "./actions";

const config = {
  slug: "sabores",
  name: "Sabores",
  currency: "COP",
  services: [{ id: "bandeja", name: "Bandeja", description: "", price: 20000 }],
};

function cliente(cambios: Record<string, unknown> = {}) {
  return {
    id: "l1",
    businessSlug: "sabores",
    channel: "whatsapp",
    contact: "573000000001",
    name: "Ana Gómez",
    state: "interesado",
    stage: "carrito_abierto",
    items: [{ serviceId: "bandeja", cantidad: 2 }],
    followUpsSent: [],
    lastInboundAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    ...cambios,
  };
}

function fd(leadId: string, primero = ""): FormData {
  const f = new FormData();
  f.set("slug", "sabores");
  f.set("leadId", leadId);
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
  m.send.mockResolvedValue(undefined);
  m.getOrCreate.mockResolvedValue({ history: [] });
});

describe("enviarSeguimientoAhora", () => {
  it("le manda al cliente el texto del cuadro y lo anota (primer seguimiento + historial)", async () => {
    negocioPropio(true);
    m.getById.mockResolvedValue(cliente({ id: "a" }));
    const r = await enviarSeguimientoAhora({}, fd("a", "Hola{{nombre}}, ¿retomamos {{pedido}}?"));
    expect(r.ok).toBeTruthy();
    expect(m.send).toHaveBeenCalledWith({ to: "573000000001", text: "Hola Ana, ¿retomamos 2 Bandeja?" });
    expect(m.saveLead).toHaveBeenCalledWith(expect.objectContaining({ followUpsSent: ["2h"] }));
    expect(m.saveSesion).toHaveBeenCalledWith({
      history: [expect.objectContaining({ role: "assistant", text: "Hola Ana, ¿retomamos 2 Bandeja?" })],
    });
  });

  it("un negocio que no es de la dueña no manda nada", async () => {
    negocioPropio(false);
    const r = await enviarSeguimientoAhora({}, fd("b"));
    expect(r.error).toBeTruthy();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("un cliente de OTRO negocio no recibe nada aunque llegue su id", async () => {
    negocioPropio(true);
    m.getById.mockResolvedValue(cliente({ id: "c", businessSlug: "otro" }));
    const r = await enviarSeguimientoAhora({}, fd("c"));
    expect(r.error).toContain("no encontrado");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("a quien pidió que no le escriban no se le manda", async () => {
    negocioPropio(true);
    m.getById.mockResolvedValue(cliente({ id: "d", noContactar: true }));
    const r = await enviarSeguimientoAhora({}, fd("d"));
    expect(r.error).toContain("ya no se le puede escribir");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("dos clics seguidos mandan un solo mensaje", async () => {
    negocioPropio(true);
    m.getById.mockResolvedValue(cliente({ id: "e" }));
    await enviarSeguimientoAhora({}, fd("e"));
    const r = await enviarSeguimientoAhora({}, fd("e"));
    expect(r.error).toContain("hace un momento");
    expect(m.send).toHaveBeenCalledTimes(1);
  });
});
