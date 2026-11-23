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
let firmaAnotada = false;

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

/**
 * Las claves con las que puede venir firmado el aviso. La app de Meta tiene
 * DOS: la "clave secreta de la aplicación de Instagram" y la clave secreta
 * general de la app (la que firma los avisos de WhatsApp). La documentación
 * no deja claro cuál usa Meta para los webhooks de Instagram en una app que
 * tiene los dos productos, y en la primera prueba real la de Instagram no
 * coincidió. Se acepta cualquiera de las dos: ambas son secretos de NUESTRA
 * app, así que un aviso sin firma o firmado por otro sigue rechazado.
 */
function clavesDeFirma(): string[] {
  return [process.env.INSTAGRAM_APP_SECRET, process.env.WHATSAPP_APP_SECRET].filter(
    (c): c is string => !!c && c.trim().length > 0,
  ).map((c) => c.trim());
}

export async function POST(request: Request): Promise<Response> {
  const claves = clavesDeFirma();
  if (!process.env.INSTAGRAM_APP_SECRET || claves.length === 0) {
    console.error("[Instagram] INSTAGRAM_APP_SECRET no está configurado: se rechaza el evento.");
    return new Response("Webhook not configured", { status: 503 });
  }
  const rawBody = await request.text();
  const firma = request.headers.get("x-hub-signature-256");
  const conCual = claves.findIndex((c) => verifySignature(rawBody, firma, c));
  if (conCual < 0) {
    // A diferencia del de WhatsApp, se anota: es la causa más común de "no
    // pasa nada" al configurar.
    console.warn("[Instagram] firma inválida: no coincide con INSTAGRAM_APP_SECRET ni con WHATSAPP_APP_SECRET");
    return new Response("Invalid signature", { status: 401 });
  }
  // Una vez, para saber cuál usa Meta y dejar de adivinar.
  if (!firmaAnotada) {
    firmaAnotada = true;
    console.info(`[Instagram] firma válida con ${conCual === 0 ? "INSTAGRAM_APP_SECRET" : "WHATSAPP_APP_SECRET"}`);
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

  const comentarios = parseComentarios(payload);
  // Diagnóstico (T-108): en la primera prueba real "no pasaba nada" y no había
  // forma de saber si Meta no mandaba el aviso o si llegaba y se descartaba.
  // Se anota qué llegó y qué se decidió, sin el texto ni el usuario de nadie.
  if (comentarios.length === 0) {
    console.info(`[Instagram] aviso sin comentarios reconocibles (${resumirAviso(payload)})`);
  }
  for (const comentario of comentarios) {
    try {
      const respuesta = decidirRespuesta(comentario, respuestas);
      if (!respuesta) {
        const motivo = comentario.esPropio ? "es de la propia cuenta" : comentario.esRespuesta ? "es respuesta en un hilo" : "sin palabra clave";
        console.info(`[Instagram] comentario ${comentario.id}: no se responde (${motivo})`);
        continue;
      }
      // Meta reintenta el webhook si tardamos: el mismo comentario no se contesta dos veces.
      if (!(await dedupe.claim(`ig-comentario:${comentario.id}`))) {
        console.info(`[Instagram] comentario ${comentario.id}: ya se había respondido`);
        continue;
      }
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

/**
 * Forma del aviso, sin datos: `object`, y por entrada los nombres de los
 * campos ("changes:comments", "messaging"…). Sirve para ver de un vistazo si
 * Meta mandó algo que el lector no espera.
 */
export function resumirAviso(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "no es un objeto";
  const p = payload as Record<string, unknown>;
  const entradas = Array.isArray(p.entry) ? p.entry : [];
  const campos = entradas.map((e) => {
    if (typeof e !== "object" || e === null) return "?";
    const en = e as Record<string, unknown>;
    if (Array.isArray(en.changes)) {
      return `changes:${en.changes.map((c) => (c && typeof c === "object" ? String((c as Record<string, unknown>).field) : "?")).join("+")}`;
    }
    return Object.keys(en).filter((k) => k !== "id" && k !== "time").join("+") || "vacía";
  });
  return `object=${String(p.object)} entradas=${entradas.length} [${campos.join(", ")}]`;
}
