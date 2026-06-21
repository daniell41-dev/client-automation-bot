import { describe, expect, it, vi } from "vitest";
import { buildSendRequest, WhatsAppChannel } from "@/core/channels/whatsapp/send";

const opts = {
  phoneNumberId: "111111111111111",
  accessToken: "TOKEN",
};

describe("buildSendRequest", () => {
  it("construye URL, headers y body correctos", () => {
    const { url, init } = buildSendRequest(opts, {
      to: "573009998877",
      text: "Hola 💜",
    });
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/111111111111111/messages",
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TOKEN");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe("573009998877");
    expect(body.type).toBe("text");
    expect(body.text.body).toBe("Hola 💜");
  });

  it("respeta una apiVersion personalizada", () => {
    const { url } = buildSendRequest({ ...opts, apiVersion: "v22.0" }, {
      to: "x",
      text: "y",
    });
    expect(url).toContain("/v22.0/");
  });
});

describe("WhatsAppChannel.send", () => {
  it("llama a fetch con la request construida", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true } as Response);
    const channel = new WhatsAppChannel({ ...opts, fetchImpl });
    await channel.send({ to: "573009998877", text: "Hola" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(channel.channel).toBe("whatsapp");
  });

  it("lanza si la respuesta no es ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad request",
    } as Response);
    const channel = new WhatsAppChannel({ ...opts, fetchImpl });
    await expect(channel.send({ to: "x", text: "y" })).rejects.toThrow(/400/);
  });
});
