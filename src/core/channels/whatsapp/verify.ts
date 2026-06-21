/**
 * Verificación del webhook de WhatsApp Cloud API.
 *
 * Dos cosas:
 *  1. Handshake inicial (`GET`): Meta envía `hub.challenge` y hay que devolverlo
 *     si el `hub.verify_token` coincide con el nuestro.
 *  2. Firma de eventos (`POST`): cada evento trae `X-Hub-Signature-256`, un
 *     HMAC-SHA256 del cuerpo CRUDO con el App Secret. Hay que validarlo.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface ChallengeParams {
  mode: string | null;
  token: string | null;
  challenge: string | null;
  expectedToken: string;
}

/**
 * Devuelve el `challenge` si la verificación es correcta, o `null` si no.
 * El handler debe responder el challenge en texto plano cuando no es null.
 */
export function verifyChallenge({
  mode,
  token,
  challenge,
  expectedToken,
}: ChallengeParams): string | null {
  if (mode === "subscribe" && token === expectedToken) {
    return challenge;
  }
  return null;
}

/**
 * Valida la firma `X-Hub-Signature-256` recalculando el HMAC sobre el raw body.
 * Usa comparación en tiempo constante para evitar ataques de temporización.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);
  if (received.length !== computed.length) return false;
  return timingSafeEqual(received, computed);
}
