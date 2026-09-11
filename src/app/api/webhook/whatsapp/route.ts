/**
 * Webhook de WhatsApp Cloud API.
 *
 *  GET  → verificación del webhook (devuelve `hub.challenge`).
 *  POST → valida la firma y responde 200 DE INMEDIATO — Meta reintenta el
 *         mismo mensaje si el ACK tarda, lo que hacía que el bot respondiera
 *         dos veces. El procesamiento real (resolver negocio, llamar IA,
 *         guardar lead, enviar respuesta) corre DESPUÉS, dentro de `after()`
 *         (`next/server`), sin bloquear la respuesta. Si igual llega un
 *         reintento, `processWebhookPayload` lo deduplica por `message.id`.
 *
 * La capa Next solo traduce HTTP ↔ tipos del core; la lógica vive en `core/`.
 */

import { after } from "next/server";
import {
  verifyChallenge,
  verifySignature,
} from "@/core/channels/whatsapp/verify";
import { parseInbound } from "@/core/channels/whatsapp/parse";
import { WhatsAppChannel } from "@/core/channels/whatsapp/send";
import { resolveBusinessByPhoneNumberId } from "@/businesses/resolve";
import {
  createCalendar,
  createLeadRepository,
  createMessageDedupeRepository,
  createSessionRepository,
} from "@/core/storage/factory";
import { createLLMProvider } from "@/core/ai/factory";
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

/** POST: valida y responde 200 de inmediato; el procesamiento corre en `after()`. */
export async function POST(request: Request): Promise<Response> {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // El raw body es necesario para validar la firma antes de parsear. Esto es
  // síncrono/local (sin I/O de red) — corre antes del ACK sin costo real.
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

  // Todo lo que hace I/O (resolver negocio, llamar IA, guardar lead, mandar
  // la respuesta) corre DESPUÉS de este punto — nunca bloquea el ACK a Meta.
  after(() => processWebhookPayload(payload));

  return new Response("OK", { status: 200 });
}

/**
 * Procesa los mensajes de un payload ya validado (firma + JSON). Corre
 * dentro de `after()` — ver `POST` — nunca bloquea el ACK a Meta. Exportada
 * aparte para poder testearla directamente, sin depender del runtime de
 * `after()` de Next (que solo existe dentro de una request real).
 */
export async function processWebhookPayload(payload: unknown): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const llm = createLLMProvider();
  const dedupe = createMessageDedupeRepository();

  try {
    for (const parsed of parseInbound(payload)) {
      // Idempotencia: un reintento de Meta trae el MISMO message.id. Si ya
      // se reclamó, no se reprocesa — evita que el cliente reciba la
      // respuesta duplicada. Sin `messageId` (payload atípico) se procesa
      // igual: perder la protección de UN mensaje es mejor que perderlo del todo.
      if (parsed.messageId && !(await dedupe.claim(parsed.messageId))) {
        continue;
      }

      const resolved = await resolveBusinessByPhoneNumberId(parsed.phoneNumberId);
      if (!resolved) continue; // negocio no registrado → ignorar
      const business = resolved.config;
      if (business.botActivo === false) continue; // bot en pausa → no responder

      const repo = createLeadRepository(business);
      const sessionRepo = llm ? createSessionRepository(business) : undefined;
      const calendar = createCalendar(business) ?? undefined;

      // Mismo canal para responderle al cliente y para avisarle a la dueña
      // (es el número de WhatsApp Business del negocio en ambos casos).
      const channel = accessToken
        ? new WhatsAppChannel({ phoneNumberId: parsed.phoneNumberId, accessToken })
        : undefined;

      const message: IncomingMessage = {
        channel: "whatsapp",
        businessSlug: business.slug,
        from: parsed.from,
        text: parsed.text,
        timestamp: parsed.timestamp,
        contactName: parsed.contactName,
      };

      const { messages: replies } = await handleIncoming(
        message,
        business,
        repo,
        new Date(),
        llm ?? undefined,
        sessionRepo,
        calendar,
        channel,
      );

      if (channel) {
        for (const reply of replies) {
          await channel.send(reply);
        }
      }
    }
  } catch (err) {
    // Nunca dejamos caer el proceso por un evento; a Meta ya se le respondió
    // 200 (el ACK ya salió en POST), así que no reintentará por esto — solo
    // queda el log.
    console.error("Error procesando webhook de WhatsApp:", err);
  }
}
