/**
 * Webhook de WhatsApp Cloud API.
 *
 *  GET  → verificación del webhook (devuelve `hub.challenge`).
 *  POST → recepción de mensajes: valida firma, parsea, resuelve el negocio,
 *         corre el motor (guardando el lead) y envía las respuestas.
 *
 * La capa Next solo traduce HTTP ↔ tipos del core; la lógica vive en `core/`.
 */

import {
  verifyChallenge,
  verifySignature,
} from "@/core/channels/whatsapp/verify";
import { parseInbound } from "@/core/channels/whatsapp/parse";
import { WhatsAppChannel } from "@/core/channels/whatsapp/send";
import { getBusinessByPhoneNumberId } from "@/businesses/registry";
import { JsonLeadRepository } from "@/core/storage/adapters/json";
import { SessionJsonRepository } from "@/core/storage/adapters/session-json";
import { createGroqProvider } from "@/core/ai/groq";
import { handleIncoming } from "@/core/handle";
import type { IncomingMessage } from "@/core/types";

// Necesitamos el runtime de Node (módulo crypto para la firma HMAC).
export const runtime = "nodejs";

/** GET: handshake de verificación del webhook. */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const challenge = verifyChallenge({
    mode: searchParams.get("hub.mode"),
    token: searchParams.get("hub.verify_token"),
    challenge: searchParams.get("hub.challenge"),
    expectedToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  });

  if (challenge !== null) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

/** POST: recepción y procesamiento de mensajes entrantes. */
export async function POST(request: Request): Promise<Response> {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  // El raw body es necesario para validar la firma antes de parsear.
  const rawBody = await request.text();

  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature, appSecret)) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const repo = new JsonLeadRepository();
  const llm = createGroqProvider();
  const sessionRepo = llm ? new SessionJsonRepository() : undefined;

  try {
    for (const parsed of parseInbound(payload)) {
      const business = getBusinessByPhoneNumberId(parsed.phoneNumberId);
      if (!business) continue; // negocio no registrado → ignorar

      const message: IncomingMessage = {
        channel: "whatsapp",
        businessSlug: business.slug,
        from: parsed.from,
        text: parsed.text,
        timestamp: parsed.timestamp,
        contactName: parsed.contactName,
      };

      const replies = await handleIncoming(
        message,
        business,
        repo,
        new Date(),
        llm ?? undefined,
        sessionRepo,
      );

      if (accessToken) {
        const channel = new WhatsAppChannel({
          phoneNumberId: parsed.phoneNumberId,
          accessToken,
        });
        for (const reply of replies) {
          await channel.send(reply);
        }
      }
    }
  } catch (err) {
    // Nunca dejamos caer el server por un evento; Meta reintentará si hace falta.
    console.error("Error procesando webhook de WhatsApp:", err);
  }

  // Meta espera un 200 rápido para no reintentar.
  return new Response("OK", { status: 200 });
}
