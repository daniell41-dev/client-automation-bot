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
  createPedidoRepository,
  createLeadRepository,
  getWompiEventsSecret,
  createWhatsAppUsageRepository,
} from "@/core/storage/factory";
import { handleWompiWebhookEvent } from "@/core/handle";
import { WhatsAppChannel } from "@/core/channels/whatsapp/send";

export const runtime = "nodejs";

/** `amount_in_cents` del evento, o `undefined` si no vino un número. */
function montoDelEvento(event: WompiWebhookEvent): number | undefined {
  const monto = Number(event.data?.transaction?.amount_in_cents);
  return Number.isFinite(monto) ? monto : undefined;
}

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

    // T-34: `reference` es el id del PEDIDO (links armados antes de T-34:
    // el id del lead). Los dos son UUID globales, así que se puede buscar sin
    // saber todavía a qué negocio pertenece.
    const pedidos = createPedidoRepository();
    const pedido = await pedidos.obtener(reference).catch(() => null);
    const repoSinNegocio = createLeadRepository();
    const lead = await repoSinNegocio.getById(pedido?.leadId ?? reference);
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
      pedidos,
      { pedido, montoEnCentavos: montoDelEvento(event) },
    );

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (accessToken && resolved.whatsappPhoneNumberId) {
      const channel = new WhatsAppChannel({
        phoneNumberId: resolved.whatsappPhoneNumberId,
        accessToken,
        medidor: { negocio: resolved.negocioId ?? config.slug, repo: createWhatsAppUsageRepository() },
      });
      if (result.customerMessage) await channel.send(result.customerMessage);
      // Texto libre: si la dueña no escribió en 24h, Meta lo rechaza y queda
      // en el log. La plantilla de aprobación no sirve acá (pide decidir
      // algo que ya está decidido).
      if (result.ownerMessage) {
        await channel.send(result.ownerMessage).catch((err) => {
          console.error("[Wompi] no se pudo avisar a la dueña:", err);
        });
      }
    }
  } catch (err) {
    // Nunca dejamos caer el proceso por un evento; a Wompi ya se le
    // respondió 200 (el ACK ya salió en POST), así que no reintentará por
    // esto — solo queda el log.
    console.error("Error procesando webhook de Wompi:", err);
  }
}
