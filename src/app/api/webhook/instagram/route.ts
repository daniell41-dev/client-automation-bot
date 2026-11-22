/**
 * T-108: webhook de Instagram (cuenta de Aurela). Por ahora atiende solo
 * comentarios: quien comenta una palabra clave recibe un DM con el enlace a
 * la página (ver `core/channels/instagram/comentarios.ts`). Es la primera
 * pieza del canal de Instagram; los DMs de los clientes de cada negocio
 * llegan después por este mismo webhook.
 *
 * Misma seguridad que el de WhatsApp: verificación GET con token, firma
 * X-Hub-Signature-256 obligatoria (falla CERRADO sin el App Secret: la URL es
 * pública) y ACK inmediato a Meta con el trabajo en `after()`.
 */

import { after } from "next/server";
import { verifyChallenge, verifySignature } from "@/core/channels/whatsapp/verify";
import {
  decidirRespuesta,
  parseComentarios,
  RecordadorDeAutores,
  type RespuestaComentario,
} from "@/core/channels/instagram/comentarios";
import { InstagramClient } from "@/core/channels/instagram/send";
import type { MessageDedupeRepository } from "@/core/storage/dedupe-repository";
import { createMessageDedupeRepository } from "@/core/storage/factory";
import { RESPUESTAS_COMENTARIOS } from "@/lib/instagram-respuestas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un solo recordador por proceso: no escribirle a la misma persona dos veces en 24 h. */
const recordador = new RecordadorDeAutores();

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const challenge = verifyChallenge({
    mode: params.get("hub.mode"),
    token: params.get("hub.verify_token"),
    challenge: params.get("hub.challenge"),
    expectedToken: process.env.INSTAGRAM_VERIFY_TOKEN ?? "",
  });
  return challenge !== null
    ? new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
    : new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request): Promise<Response> {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    console.error("[Instagram] INSTAGRAM_APP_SECRET no está configurado: se rechaza el evento.");
    return new Response("Webhook not configured", { status: 503 });
  }
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    // A diferencia del de WhatsApp, se anota: es la causa más común de "no
    // pasa nada" al configurar (App Secret de Instagram vs. el de la app).
    console.warn("[Instagram] firma inválida: revise INSTAGRAM_APP_SECRET");
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  after(() => procesarComentarios(payload));
  return new Response("OK", { status: 200 });
}

export interface DependenciasComentarios {
  cliente: Pick<InstagramClient, "responderPrivado" | "responderPublico">;
  dedupe: Pick<MessageDedupeRepository, "claim">;
  respuestas?: RespuestaComentario[];
  ahora?: Date;
}

/** Exportada para probarla sin Meta. Nunca lanza: corre después del ACK. */
export async function procesarComentarios(payload: unknown, deps?: DependenciasComentarios): Promise<void> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!deps && !accessToken) {
    console.error("[Instagram] INSTAGRAM_ACCESS_TOKEN no está configurado: no se puede responder.");
    return;
  }
  const cliente =
    deps?.cliente ?? new InstagramClient({ accessToken: accessToken!, apiVersion: process.env.INSTAGRAM_API_VERSION });
  const dedupe = deps?.dedupe ?? createMessageDedupeRepository();
  const respuestas = deps?.respuestas ?? RESPUESTAS_COMENTARIOS;
  const conRespuestaPublica = process.env.INSTAGRAM_RESPUESTA_PUBLICA !== "false";

  for (const comentario of parseComentarios(payload)) {
    try {
      const respuesta = decidirRespuesta(comentario, respuestas);
      if (!respuesta) continue;
      // Meta reintenta el webhook si tardamos: el mismo comentario no se contesta dos veces.
      if (!(await dedupe.claim(`ig-comentario:${comentario.id}`))) continue;
      if (!recordador.puedeEscribir(comentario.autorId, deps?.ahora ?? new Date())) {
        console.info(`[Instagram] comentario ${comentario.id}: ya se le escribió hace poco a esa cuenta`);
        continue;
      }
      await cliente.responderPrivado(comentario.cuentaId, comentario.id, respuesta.mensaje);
      console.info(`[Instagram] DM enviado por el comentario ${comentario.id}`);
      if (respuesta.respuestaPublica && conRespuestaPublica) {
        // Aparte: si falla la pública, el DM ya salió y es lo que importa.
        await cliente
          .responderPublico(comentario.id, respuesta.respuestaPublica)
          .catch((err) => console.error(`[Instagram] no se pudo responder en público ${comentario.id}:`, err));
      }
    } catch (err) {
      console.error(`[Instagram] no se pudo responder el comentario ${comentario.id}:`, err);
    }
  }
}
