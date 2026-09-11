import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyChallenge, verifySignature } from "@/core/channels/whatsapp/verify";

describe("verifyChallenge", () => {
  it("devuelve el challenge cuando el token coincide", () => {
    expect(
      verifyChallenge({
        mode: "subscribe",
        token: "secreto",
        challenge: "12345",
        expectedToken: "secreto",
      }),
    ).toBe("12345");
  });

  it("devuelve null si el token no coincide", () => {
    expect(
      verifyChallenge({
        mode: "subscribe",
        token: "malo",
        challenge: "12345",
        expectedToken: "secreto",
      }),
    ).toBeNull();
  });

  it("devuelve null si el mode no es subscribe", () => {
    expect(
      verifyChallenge({
        mode: "unsubscribe",
        token: "secreto",
        challenge: "12345",
        expectedToken: "secreto",
      }),
    ).toBeNull();
  });
});

describe("verifySignature", () => {
  const appSecret = "app-secret-123";
  const body = JSON.stringify({ hello: "world" });
  const validSig =
    "sha256=" + createHmac("sha256", appSecret).update(body, "utf8").digest("hex");

  it("acepta una firma válida", () => {
    expect(verifySignature(body, validSig, appSecret)).toBe(true);
  });

  it("rechaza una firma inválida", () => {
    expect(verifySignature(body, "sha256=deadbeef", appSecret)).toBe(false);
  });

  it("rechaza cuando falta el header", () => {
    expect(verifySignature(body, null, appSecret)).toBe(false);
  });

  it("rechaza si el cuerpo fue alterado", () => {
    expect(verifySignature(body + "x", validSig, appSecret)).toBe(false);
  });
});
