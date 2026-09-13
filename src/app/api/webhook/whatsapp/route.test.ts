import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
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

/** App Secret de prueba: el webhook exige firma válida (ver `POST` en route.ts). */
const APP_SECRET = "test-app-secret";

/** Request firmada igual que la manda Meta: HMAC-SHA256 del cuerpo crudo. */
function makeRequest(payload: unknown, secret: string | null = APP_SECRET): Request {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    headers["x-hub-signature-256"] =
      "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
  }
  return new Request("http://localhost/api/webhook/whatsapp", {
    method: "POST",
    headers,
    body,
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
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    // El webhook exige firma válida: el camino normal de estos tests es el
    // mismo que en producción (App Secret configurado + request firmada).
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
    delete process.env.WHATSAPP_ALLOW_UNSIGNED;
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

  it("responde 401 si la request viene sin firma", async () => {
    const response = await POST(makeRequest(makePayload("wamid.NO-SIG"), null));

    expect(response.status).toBe(401);
    expect(afterCalls).toHaveLength(0);
  });

  // Regresión: la validación vivía dentro de un `if (appSecret)`, así que un
  // despliegue sin la variable procesaba cualquier POST de cualquiera.
  it("sin WHATSAPP_APP_SECRET falla cerrado: 503 y nada de procesamiento", async () => {
    delete process.env.WHATSAPP_APP_SECRET;

    const response = await POST(makeRequest(makePayload("wamid.NO-SECRET"), null));

    expect(response.status).toBe(503);
    expect(afterCalls).toHaveLength(0);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("WHATSAPP_ALLOW_UNSIGNED=true es la salida explícita para desarrollo", async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_ALLOW_UNSIGNED = "true";

    const response = await POST(makeRequest(makePayload("wamid.UNSIGNED-OK"), null));

    expect(response.status).toBe(200);
    expect(afterCalls).toHaveLength(1);
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
