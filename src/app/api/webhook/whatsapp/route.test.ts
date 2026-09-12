import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Capturamos el callback que `POST` le pasa a `after()` en vez de ejecutarlo:
// así podemos comprobar que el ACK sale ANTES de que el callback corra.
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
  resolveBusinessByPhoneNumberId: vi.fn(),
}));

const { resolveBusinessByPhoneNumberId } = await import("@/businesses/resolve");
const resolveMock = vi.mocked(resolveBusinessByPhoneNumberId);

// Se importan DESPUÉS de los mocks de arriba (vi.mock se hoistea, pero el
// import dinámico de la ruta necesita que los mocks ya estén registrados).
const { POST, processWebhookPayload } = await import(
  "@/app/api/webhook/whatsapp/route"
);

// Mismo fixture mínimo que usa handle.test.ts: alcanza para que el motor
// determinista responda (fallback) sin necesitar IA ni catálogo real.
const business: import("@/core/types").BusinessConfig = {
  slug: "estetica-bella",
  name: "Estética Bella",
  currency: "COP",
  services: [],
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

function makePayload(messageId: string, text = "Hola") {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "111111111111111" },
              contacts: [{ profile: { name: "Laura" }, wa_id: "573009998877" }],
              messages: [
                {
                  from: "573009998877",
                  id: messageId,
                  timestamp: "1750500000",
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/webhook/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/webhook/whatsapp", () => {
  let dir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "webhook-test-"));
    process.env.LEADS_FILE = join(dir, "leads.json");
    process.env.DEDUPE_FILE = join(dir, "processed-messages.json");
    // Sin credenciales de IA/WhatsApp/Supabase → engine determinista, sin
    // llamadas de red reales.
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    afterCalls.length = 0;
    resolveMock.mockReset();
    resolveMock.mockResolvedValue({ config: business, esDemo: false });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(dir, { recursive: true, force: true });
  });

  it("responde 200 de inmediato sin procesar el mensaje todavía", async () => {
    const request = makeRequest(makePayload("wamid.ACK-1"));

    const response = await POST(request);

    expect(response.status).toBe(200);
    // El callback quedó agendado en after(), no ejecutado durante POST().
    expect(afterCalls).toHaveLength(1);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("el procesamiento real ocurre recién después del ACK, al correr el callback de after()", async () => {
    const request = makeRequest(makePayload("wamid.ACK-2"));

    await POST(request);
    expect(resolveMock).not.toHaveBeenCalled();

    // Simulamos que Next corre el callback diferido después de responder.
    await afterCalls[0]();

    expect(resolveMock).toHaveBeenCalledTimes(1);
  });

  it("responde 401 con firma inválida y no agenda procesamiento", async () => {
    process.env.WHATSAPP_APP_SECRET = "shh";
    const request = new Request("http://localhost/api/webhook/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      body: JSON.stringify(makePayload("wamid.BAD-SIG")),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(afterCalls).toHaveLength(0);
  });
});

describe("processWebhookPayload — idempotencia por message.id", () => {
  let dir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "webhook-test-"));
    process.env.LEADS_FILE = join(dir, "leads.json");
    process.env.DEDUPE_FILE = join(dir, "processed-messages.json");
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resolveMock.mockReset();
    resolveMock.mockResolvedValue({ config: business, esDemo: false });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(dir, { recursive: true, force: true });
  });

  it("un reintento de Meta con el mismo message.id no vuelve a procesarse", async () => {
    const payload = makePayload("wamid.RETRY-1", "Hola, quiero info");

    await processWebhookPayload(payload);
    await processWebhookPayload(payload); // mismo message.id: reintento de Meta

    expect(resolveMock).toHaveBeenCalledTimes(1);
  });

  it("dos message.id distintos sí se procesan cada uno", async () => {
    await processWebhookPayload(makePayload("wamid.A", "Hola"));
    await processWebhookPayload(makePayload("wamid.B", "Hola"));

    expect(resolveMock).toHaveBeenCalledTimes(2);
  });
});
