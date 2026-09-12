import { describe, expect, it } from "vitest";
import { parseInbound } from "@/core/channels/whatsapp/parse";

// Payload de ejemplo con la forma real de un webhook de mensajes de Meta.
const samplePayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "573001112233",
              phone_number_id: "111111111111111",
            },
            contacts: [
              { profile: { name: "Laura Pérez" }, wa_id: "573009998877" },
            ],
            messages: [
              {
                from: "573009998877",
                id: "wamid.ABC",
                timestamp: "1750500000",
                type: "text",
                text: { body: "Hola, quiero info de limpieza facial" },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("parseInbound", () => {
  it("extrae mensaje de texto, remitente, phone_number_id y nombre", () => {
    const messages = parseInbound(samplePayload);
    expect(messages).toHaveLength(1);
    const m = messages[0];
    expect(m.phoneNumberId).toBe("111111111111111");
    expect(m.from).toBe("573009998877");
    expect(m.text).toBe("Hola, quiero info de limpieza facial");
    expect(m.contactName).toBe("Laura Pérez");
    expect(m.timestamp).toBe(new Date(1750500000 * 1000).toISOString());
    expect(m.messageId).toBe("wamid.ABC");
  });

  it("messageId queda undefined si el payload no lo trae (no descarta el mensaje)", () => {
    const sinId = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                messages: [
                  { from: "573009998877", type: "text", text: { body: "hola" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const messages = parseInbound(sinId);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBeUndefined();
  });

  it("ignora eventos de estado (sin messages)", () => {
    const statusPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                statuses: [{ status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    expect(parseInbound(statusPayload)).toEqual([]);
  });

  it("ignora mensajes que no son de texto", () => {
    const imagePayload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                messages: [
                  { from: "573009998877", type: "image", image: { id: "x" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseInbound(imagePayload)).toEqual([]);
  });

  it("tolera payloads vacíos o inválidos", () => {
    expect(parseInbound(undefined)).toEqual([]);
    expect(parseInbound({})).toEqual([]);
    expect(parseInbound({ entry: [] })).toEqual([]);
  });
});
