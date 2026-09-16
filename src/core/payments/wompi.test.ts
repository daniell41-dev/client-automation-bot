import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WompiGateway, verifyWompiSignature, type WompiWebhookEvent } from "@/core/payments/wompi";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

describe("WompiGateway.buildPaymentLink", () => {
  const gateway = new WompiGateway({ publicKey: "pub_test_123", integritySecret: "secreto-integridad" });

  it("arma la URL con los parámetros del checkout y la firma de integridad correcta", () => {
    const url = gateway.buildPaymentLink({ reference: "lead-1", amountInCents: 4500000, currency: "COP" });
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe("https://checkout.wompi.co/p/");
    expect(parsed.searchParams.get("public-key")).toBe("pub_test_123");
    expect(parsed.searchParams.get("currency")).toBe("COP");
    expect(parsed.searchParams.get("amount-in-cents")).toBe("4500000");
    expect(parsed.searchParams.get("reference")).toBe("lead-1");

    const esperado = sha256Hex("lead-1" + "4500000" + "COP" + "secreto-integridad");
    expect(parsed.searchParams.get("signature:integrity")).toBe(esperado);
  });

  it("incluye redirect-url solo si se pasa", () => {
    const conRedirect = new URL(
      gateway.buildPaymentLink({
        reference: "lead-1",
        amountInCents: 1000,
        currency: "COP",
        redirectUrl: "https://ejemplo.com/gracias",
      }),
    );
    expect(conRedirect.searchParams.get("redirect-url")).toBe("https://ejemplo.com/gracias");

    const sinRedirect = new URL(
      gateway.buildPaymentLink({ reference: "lead-1", amountInCents: 1000, currency: "COP" }),
    );
    expect(sinRedirect.searchParams.has("redirect-url")).toBe(false);
  });

  it("respeta un checkoutBaseUrl de sandbox", () => {
    const sandbox = new WompiGateway({
      publicKey: "pub_test",
      integritySecret: "x",
      checkoutBaseUrl: "https://checkout.co.uat.wompi.dev/p/",
    });
    const url = new URL(sandbox.buildPaymentLink({ reference: "r", amountInCents: 1, currency: "COP" }));
    expect(url.origin + url.pathname).toBe("https://checkout.co.uat.wompi.dev/p/");
  });

  it("dos referencias distintas arman firmas de integridad distintas", () => {
    const url1 = new URL(gateway.buildPaymentLink({ reference: "a", amountInCents: 1000, currency: "COP" }));
    const url2 = new URL(gateway.buildPaymentLink({ reference: "b", amountInCents: 1000, currency: "COP" }));
    expect(url1.searchParams.get("signature:integrity")).not.toBe(url2.searchParams.get("signature:integrity"));
  });
});

describe("verifyWompiSignature", () => {
  const eventsSecret = "secreto-eventos";

  function eventoFirmado(
    transaction: WompiWebhookEvent["data"]["transaction"],
    properties: string[],
    timestamp: number,
    secretoParaFirmar = eventsSecret,
  ): WompiWebhookEvent {
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
    const checksum = sha256Hex(`${concatenado}${timestamp}${secretoParaFirmar}`);
    return {
      event: "transaction.updated",
      data: { transaction },
      signature: { properties, checksum },
      timestamp,
    };
  }

  it("firma válida: el checksum calculado coincide", () => {
    const event = eventoFirmado(
      { id: "tx-1", status: "APPROVED", amount_in_cents: 4500000, reference: "lead-1" },
      ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      1758000000,
    );
    expect(verifyWompiSignature(event, eventsSecret)).toBe(true);
  });

  it("firma inválida: firmado con un secreto distinto", () => {
    const event = eventoFirmado(
      { id: "tx-1", status: "APPROVED", amount_in_cents: 4500000 },
      ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      1758000000,
      "secreto-equivocado",
    );
    expect(verifyWompiSignature(event, eventsSecret)).toBe(false);
  });

  it("firma inválida: el checksum no cambió pero los datos sí (tampering)", () => {
    const event = eventoFirmado(
      { id: "tx-1", status: "APPROVED", amount_in_cents: 4500000 },
      ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      1758000000,
    );
    event.data.transaction.amount_in_cents = 1; // alguien cambió el monto después de firmar
    expect(verifyWompiSignature(event, eventsSecret)).toBe(false);
  });

  it("nunca lanza ante un evento mal formado — devuelve false", () => {
    const vacio = { event: "x", data: { transaction: {} }, signature: { properties: [], checksum: "" }, timestamp: 0 };
    expect(verifyWompiSignature(vacio as WompiWebhookEvent, eventsSecret)).toBe(false);

    const sinSignature = { event: "x", data: { transaction: {} }, timestamp: 0 } as unknown as WompiWebhookEvent;
    expect(verifyWompiSignature(sinSignature, eventsSecret)).toBe(false);
  });
});
