/**
 * Adaptador de Wompi (T-24.5, Nivel 2 — `docs/15-plan-vision-tienda.md` §4).
 * Wompi es del ecosistema Bancolombia; soporta Nequi, tarjetas y PSE.
 *
 * Dos firmas SHA-256 DISTINTAS, no confundir:
 *   - `signature:integrity` (`buildPaymentLink`): protege el LINK que arma el
 *     bot — evita que alguien cambie el monto en la URL antes de pagar.
 *     `sha256(reference + amountInCents + currency + integritySecret)`.
 *   - Firma del EVENTO del webhook (`verifyWompiSignature`): protege que el
 *     webhook realmente lo mandó Wompi. `sha256(valores de
 *     signature.properties concatenados + timestamp + eventsSecret)`. Un
 *     evento sin firma válida se descarta en silencio (§T-24.5, obligatorio).
 *
 * El bot NUNCA confía en la redirección de éxito del checkout como señal de
 * pago — la doc de Wompi es explícita en que PSE puede tardar minutos en
 * aprobarse. La única confirmación real es el webhook con firma válida.
 */

import { createHash } from "node:crypto";
import type { PaymentGateway, PaymentLinkRequest } from "@/core/payments/gateway";

export interface WompiOptions {
  publicKey: string;
  /** Secreto de integridad — arma `signature:integrity` del link de pago. Nunca se manda al cliente. */
  integritySecret: string;
  /** Base del checkout. Default: producción. Sandbox: "https://checkout.co.uat.wompi.dev/p/". */
  checkoutBaseUrl?: string;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export class WompiGateway implements PaymentGateway {
  constructor(private readonly opts: WompiOptions) {}

  buildPaymentLink(request: PaymentLinkRequest): string {
    const integrity = sha256Hex(
      `${request.reference}${request.amountInCents}${request.currency}${this.opts.integritySecret}`,
    );
    const params = new URLSearchParams({
      "public-key": this.opts.publicKey,
      currency: request.currency,
      "amount-in-cents": String(request.amountInCents),
      reference: request.reference,
      "signature:integrity": integrity,
    });
    if (request.redirectUrl) params.set("redirect-url", request.redirectUrl);
    const base = this.opts.checkoutBaseUrl ?? "https://checkout.wompi.co/p/";
    return `${base}?${params.toString()}`;
  }
}

/** Forma mínima del evento de webhook de Wompi que nos interesa. */
export interface WompiWebhookEvent {
  event: string;
  data: {
    transaction: {
      id?: string;
      status?: string;
      reference?: string;
      amount_in_cents?: number;
      [key: string]: unknown;
    };
  };
  signature: {
    /** Paths tipo "transaction.id" — el ORDEN importa, es el orden en que se concatenan. */
    properties: string[];
    checksum: string;
  };
  timestamp: number;
}

/** Resuelve un path tipo "transaction.status" contra `data` y lo devuelve como string. */
function resolveProperty(data: WompiWebhookEvent["data"], path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
      data,
    );
  return value === undefined || value === null ? "" : String(value);
}

/**
 * Verifica la firma del evento contra el secreto de eventos del negocio.
 * `false` ante CUALQUIER problema (checksum ausente, properties vacías) —
 * nunca lanza, para que el webhook lo descarte en silencio sin caerse.
 */
export function verifyWompiSignature(event: WompiWebhookEvent, eventsSecret: string): boolean {
  try {
    const properties = event.signature?.properties ?? [];
    if (properties.length === 0 || !event.signature?.checksum) return false;
    const concatenado = properties.map((p) => resolveProperty(event.data, p)).join("");
    const cadena = `${concatenado}${event.timestamp}${eventsSecret}`;
    const checksum = sha256Hex(cadena);
    return checksum.toLowerCase() === event.signature.checksum.toLowerCase();
  } catch {
    return false;
  }
}
