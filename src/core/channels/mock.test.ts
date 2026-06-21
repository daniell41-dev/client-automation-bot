import { describe, expect, it } from "vitest";
import { MockChannel } from "@/core/channels/mock";

describe("MockChannel", () => {
  it("registra los mensajes enviados en orden", async () => {
    const channel = new MockChannel();
    await channel.send({ to: "57300000000", text: "Hola" });
    await channel.send({ to: "57300000000", text: "¿Qué servicio?", options: ["Uñas"] });

    expect(channel.channel).toBe("mock");
    expect(channel.sent).toHaveLength(2);
    expect(channel.sent[0].text).toBe("Hola");
    expect(channel.sent[1].options).toEqual(["Uñas"]);
  });

  it("clear() vacía el registro", async () => {
    const channel = new MockChannel();
    await channel.send({ to: "x", text: "a" });
    channel.clear();
    expect(channel.sent).toHaveLength(0);
  });
});
