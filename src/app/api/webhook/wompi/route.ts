/**
 * Webhook de Wompi (T-24.5, Nivel 2 de confirmación de pago).
 *
 *  POST → responde 200 DE INMEDIATO (Wompi reintenta si el ACK tarda, mismo
 *         criterio que el webhook de WhatsApp) y procesa el evento después,
 *         dentro de `after()`.
 *
 * La firma del evento se verifica ANTES de tocar nada — un evento sin firma
 * válida (o de un negocio sin Wompi configurado) se descarta EN SILENCIO,
 * nunca con un 401 explícito: eso le daría a un atacante una señal de qué
 * está mal en su intento. Nunca se confía en la redirección de éxito del
 * checkout como confirmación — solo este webhook, con firma verificada.
 *
 * La capa Next solo traduce HTTP ↔ tipos del core; la lógica vive en
 * `handleWompiWebhookEvent` (`core/handle.ts`).
 */

import { after } from "next/server";
import { verifyWompiSignature, type WompiWebhookEvent } from "@/core/payments/wompi";
import type { EstadoWompi } from "@/core/engine/pago-wompi";
import { resolveBusinessBySlug } from "@/businesses/resolve";
import {
  createInventoryRepository,
  createLeadRepository,
  getWompiEventsSecret,
} from "@/core/storage/factory";
import { handleWompiWebhookEvent } from "@/core/handle";
import { WhatsAppChannel } from "@/core/channels/whatsapp/send";

export const runtime = "nodejs";

/** POST: responde 200 de inmediato; el procesamiento corre en `after()`. */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  let event: WompiWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  after(() => processWompiWebhookPayload(event));
  return new Response("OK", { status: 200 });
}

/**
 * Procesa un evento ya parseado. Exportada aparte para poder testearla
 * directo, sin depender del runtime de `after()` — mismo criterio que
 * `processWebhookPayload` del webhook de WhatsApp.
 */
export async function processWompiWebhookPayload(event: WompiWebhookEvent): Promise<void> {
  try {
    const reference = String(event.data?.transaction?.reference ?? "");
    if (!reference) return; // sin referencia no hay pedido que resolver

    // `reference` = el id del lead (pedido). Es un UUID global, así que se
    // puede buscar sin saber todavía a qué negocio pertenece.
    const repoSinNegocio = createLeadRepository();
    const lead = await repoSinNegocio.getById(reference);
    if (!lead) return; // referencia desconocida — se descarta en silencio

    const resolved = await resolveBusinessBySlug(lead.businessSlug);
    if (!resolved) return;
    const config = resolved.config;

    const eventsSecret = await getWompiEventsSecret(resolved.negocioId);
    if (!eventsSecret || !verifyWompiSignature(event, eventsSecret)) {
      console.warn(
        "[Wompi] evento descartado: firma inválida o el negocio no tiene Wompi configurado",
      );
      return;
    }

    const estado = String(event.data.transaction.status ?? "") as EstadoWompi;
    const repo = createLeadRepository(config, resolved.negocioId);
    const inventory = createInventoryRepository();
    const result = await handleWompiWebhookEvent(
      lead,
      config,
      estado,
      repo,
      inventory,
      resolved.negocioId ?? config.slug,
      new Date(),
    );

    if (result.customerMessage) {
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      if (accessToken && resolved.whatsappPhoneNumberId) {
        const channel = new WhatsAppChannel({
          phoneNumberId: resolved.whatsappPhoneNumberId,
          accessToken,
        });
        await channel.send(result.customerMessage);
      }
    }
  } catch (err) {
    // Nunca dejamos caer el proceso por un evento; a Wompi ya se le
    // respondió 200 (el ACK ya salió en POST), así que no reintentará por
    // esto — solo queda el log.
    console.error("Error procesando webhook de Wompi:", err);
  }
}
