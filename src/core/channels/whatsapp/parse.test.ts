import { describe, expect, it } from "vitest";
import { esVentanaCerradaEnEstado, parseEnviosFallidos, parseInbound } from "@/core/channels/whatsapp/parse";

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

  it("ignora tipos no soportados (sticker, ubicación, ...)", () => {
    const audioPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                messages: [
                  { from: "573009998877", type: "sticker", sticker: { id: "x" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseInbound(audioPayload)).toEqual([]);
  });

  it("T-46: una nota de voz llega con texto vacío y el media_id del audio", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                messages: [
                  {
                    from: "573009998877",
                    id: "wamid.VOZ",
                    timestamp: "1750500000",
                    type: "audio",
                    audio: { id: "audio-1", mime_type: "audio/ogg; codecs=opus", voice: true },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const [m] = parseInbound(payload);
    expect(m.text).toBe("");
    expect(m.messageId).toBe("wamid.VOZ");
    expect(m.audio).toEqual({ mediaId: "audio-1", mimeType: "audio/ogg; codecs=opus" });
  });

  it("tolera payloads vacíos o inválidos", () => {
    expect(parseInbound(undefined)).toEqual([]);
    expect(parseInbound({})).toEqual([]);
    expect(parseInbound({ entry: [] })).toEqual([]);
  });
});

describe("parseInbound — imágenes (T-23.1)", () => {
  it("extrae una imagen con caption: el texto pasa a ser el caption", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                messages: [
                  {
                    from: "573009998877",
                    id: "wamid.IMG1",
                    timestamp: "1750500000",
                    type: "image",
                    image: { id: "media-1", mime_type: "image/jpeg", caption: "esto tienen?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const messages = parseInbound(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("esto tienen?");
    expect(messages[0].image).toEqual({
      mediaId: "media-1",
      mimeType: "image/jpeg",
      caption: "esto tienen?",
    });
  });

  it("extrae una imagen sin caption: el texto queda vacío", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                messages: [
                  {
                    from: "573009998877",
                    type: "image",
                    image: { id: "media-2", mime_type: "image/png" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const messages = parseInbound(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("");
    expect(messages[0].image).toEqual({ mediaId: "media-2", mimeType: "image/png", caption: undefined });
  });

  it("una imagen sin id de media se descarta (no hay nada que descargar)", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                messages: [{ from: "573009998877", type: "image", image: {} }],
              },
            },
          ],
        },
      ],
    };
    expect(parseInbound(payload)).toEqual([]);
  });
});

describe("parseInbound — respuestas a botones (T-31)", () => {
  function conMensaje(message: Record<string, unknown>) {
    return {
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "111" }, messages: [message] } }] }],
    };
  }

  it("un botón de mensaje interactivo llega como texto (su título) + botonId", () => {
    const [m] = parseInbound(
      conMensaje({
        from: "573009998888",
        id: "wamid.B1",
        timestamp: "1750500000",
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "aprobar:ped-1", title: "Aprobar #12" } },
      }),
    );
    expect(m).toMatchObject({ text: "Aprobar #12", botonId: "aprobar:ped-1", from: "573009998888" });
  });

  it("un botón de plantilla (respuesta rápida) trae el payload como botonId", () => {
    const [m] = parseInbound(
      conMensaje({
        from: "573009998888",
        id: "wamid.B2",
        timestamp: "1750500000",
        type: "button",
        button: { payload: "rechazar:ped-1", text: "Rechazar" },
      }),
    );
    expect(m).toMatchObject({ text: "Rechazar", botonId: "rechazar:ped-1" });
  });
});

describe("parseEnviosFallidos (T-58)", () => {
  it("devuelve los envíos que Meta reportó como fallidos, con código y detalle", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111" },
                statuses: [
                  { id: "wamid.1", status: "delivered", recipient_id: "573001112233" },
                  {
                    id: "wamid.2",
                    status: "failed",
                    recipient_id: "573159998877",
                    errors: [{ code: 131047, title: "Re-engagement message", error_data: { details: "More than 24 hours have passed" } }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const fallidos = parseEnviosFallidos(payload);
    expect(fallidos).toEqual([
      { phoneNumberId: "111", destinatario: "573159998877", codigo: 131047, detalle: "More than 24 hours have passed" },
    ]);
    expect(esVentanaCerradaEnEstado(fallidos[0].codigo)).toBe(true);
    expect(parseInbound(payload)).toEqual([]);
  });
});
