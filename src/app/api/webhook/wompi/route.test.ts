import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BusinessConfig, Lead } from "@/core/types";
import type { WompiWebhookEvent } from "@/core/payments/wompi";

const afterCalls: (() => unknown)[] = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((cb: () => unknown) => {
      afterCalls.push(cb);
    }),
  };
});

vi.mock("@/businesses/resolve", () => ({
  resolveBusinessBySlug: vi.fn(),
}));

vi.mock("@/core/storage/factory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/storage/factory")>();
  return {
    ...actual,
    // Nivel 2 requiere Supabase real para las llaves — en test se inyecta
    // un secreto fijo en vez de configurar Supabase de verdad.
    getWompiEventsSecret: vi.fn(),
  };
});

const { resolveBusinessBySlug } = await import("@/businesses/resolve");
const resolveMock = vi.mocked(resolveBusinessBySlug);
const { getWompiEventsSecret } = await import("@/core/storage/factory");
const eventsSecretMock = vi.mocked(getWompiEventsSecret);
const { JsonLeadRepository } = await import("@/core/storage/adapters/json");
const { processWompiWebhookPayload } = await import("@/app/api/webhook/wompi/route");

const EVENTS_SECRET = "secreto-eventos-test";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function eventoFirmado(
  transaction: WompiWebhookEvent["data"]["transaction"],
  secret = EVENTS_SECRET,
): WompiWebhookEvent {
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const timestamp = 1758000000;
  const concatenado = properties
    .map((p) => {
      const value = p
        .split(".")
        .reduce<unknown>(
          (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
          { transaction },
        );
      return value === undefined || value === null ? "" : String(value);
    })
    .join("");
  const checksum = sha256Hex(`${concatenado}${timestamp}${secret}`);
  return {
    event: "transaction.updated",
    data: { transaction },
    signature: { properties, checksum },
    timestamp,
  };
}

const business: BusinessConfig = {
  slug: "tienda-wompi",
  name: "Tienda Wompi",
  currency: "COP",
  services: [{ id: "harina", name: "Harina 1 Kg", description: "x", price: 5000 }],
  messages: {
    welcome: "¿Qué servicio?",
    askName: "¿Nombre?",
    askDate: "¿Fecha?",
    askConfirm: "¿Confirmas {{servicio}} para {{fecha}}?",
    serviceInfo: "{{servicio}} {{precio}}",
    captured: "Listo {{nombre}}",
    fallback: "no entendí",
  },
  followUps: [],
};

function leadEsperandoPago(overrides: Partial<Lead> = {}): Lead {
  const now = new Date().toISOString();
  return {
    id: "lead-wompi-1",
    businessSlug: "tienda-wompi",
    channel: "whatsapp",
    contact: "573009998877",
    name: "Laura",
    items: [{ serviceId: "harina", cantidad: 2 }],
    state: "interesado",
    stage: "esperando_aprobacion",
    createdAt: now,
    updatedAt: now,
    lastInboundAt: now,
    followUpsSent: [],
    ...overrides,
  };
}

describe("processWompiWebhookPayload", () => {
  let dir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "wompi-webhook-test-"));
    process.env.LEADS_FILE = join(dir, "leads.json");
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    afterCalls.length = 0;
    resolveMock.mockReset();
    eventsSecretMock.mockReset();
    resolveMock.mockResolvedValue({
      config: business,
      esDemo: false,
      negocioId: "neg-1",
      whatsappPhoneNumberId: "111111111111111",
    });
    eventsSecretMock.mockResolvedValue(EVENTS_SECRET);
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(dir, { recursive: true, force: true });
  });

  it("firma inválida: se descarta en silencio, el lead no se toca", async () => {
    const repo = new JsonLeadRepository();
    await repo.save(leadEsperandoPago());

    const event = eventoFirmado(
      { id: "tx-1", status: "APPROVED", amount_in_cents: 1000000, reference: "lead-wompi-1" },
      "secreto-equivocado",
    );
    await processWompiWebhookPayload(event);

    const lead = await repo.getById("lead-wompi-1");
    expect(lead?.stage).toBe("esperando_aprobacion"); // sin cambios
  });

  it("negocio sin Wompi configurado (sin eventsSecret): se descarta en silencio", async () => {
    eventsSecretMock.mockResolvedValue(null);
    const repo = new JsonLeadRepository();
    await repo.save(leadEsperandoPago());

    const event = eventoFirmado({
      id: "tx-1",
      status: "APPROVED",
      amount_in_cents: 1000000,
      reference: "lead-wompi-1",
    });
    await processWompiWebhookPayload(event);

    const lead = await repo.getById("lead-wompi-1");
    expect(lead?.stage).toBe("esperando_aprobacion");
  });

  it("referencia que no corresponde a ningún lead: se descarta en silencio, no lanza", async () => {
    const event = eventoFirmado({
      id: "tx-1",
      status: "APPROVED",
      amount_in_cents: 1000000,
      reference: "lead-que-no-existe",
    });
    await expect(processWompiWebhookPayload(event)).resolves.toBeUndefined();
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("firma válida + APPROVED: confirma el pedido", async () => {
    const repo = new JsonLeadRepository();
    await repo.save(leadEsperandoPago());

    const event = eventoFirmado({
      id: "tx-1",
      status: "APPROVED",
      amount_in_cents: 1000000,
      reference: "lead-wompi-1",
    });
    await processWompiWebhookPayload(event);

    const lead = await repo.getById("lead-wompi-1");
    expect(lead?.stage).toBe("datos_completos");
    expect(lead?.state).toBe("pagado");
  });

  it("PENDING no confirma ni toca el lead", async () => {
    const repo = new JsonLeadRepository();
    await repo.save(leadEsperandoPago());

    const event = eventoFirmado({
      id: "tx-1",
      status: "PENDING",
      amount_in_cents: 1000000,
      reference: "lead-wompi-1",
    });
    await processWompiWebhookPayload(event);

    const lead = await repo.getById("lead-wompi-1");
    expect(lead?.stage).toBe("esperando_aprobacion");
  });

  it("DECLINED vuelve el pedido al carrito", async () => {
    const repo = new JsonLeadRepository();
    await repo.save(leadEsperandoPago());

    const event = eventoFirmado({
      id: "tx-1",
      status: "DECLINED",
      amount_in_cents: 1000000,
      reference: "lead-wompi-1",
    });
    await processWompiWebhookPayload(event);

    const lead = await repo.getById("lead-wompi-1");
    expect(lead?.stage).toBe("carrito_abierto");
    expect(lead?.state).not.toBe("pagado");
  });

  it("un payload sin reference se descarta en silencio, sin resolver ningún negocio", async () => {
    const event = eventoFirmado({ id: "tx-1", status: "APPROVED", amount_in_cents: 1000000 });
    await expect(processWompiWebhookPayload(event)).resolves.toBeUndefined();
    expect(resolveMock).not.toHaveBeenCalled();
  });
});
