/**
 * T-106: la llama un cron del VPS cada 15 minutos (ver docs/19-vps.md →
 * "Seguimiento automático"). Recorre los negocios con WhatsApp conectado y
 * los seguimientos encendidos, y manda los que tocan. Qué y cuándo lo decide
 * `core/engine/seguimientos.ts`; esta ruta solo arma el canal y la base.
 *
 * Protegida con `CRON_SECRET` (cabecera `Authorization: Bearer …`): es
 * pública en internet y, sin el secreto, cualquiera podría disparar mensajes
 * a los clientes de los negocios.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { WhatsAppChannel } from "@/core/channels/whatsapp/send";
import { procesarSeguimientos } from "@/core/engine/seguimientos";
import { procesarResumenDiario, type PedidoVenta } from "@/core/engine/ventas-del-dia";
import { createSupabaseDb } from "@/core/storage/adapters/supabase/api";
import {
  createLeadRepository,
  createSessionRepository,
  createWhatsAppUsageRepository,
} from "@/core/storage/factory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Solo se revisan los leads que escribieron en las últimas 24 h: los demás ya no están en la ventana de WhatsApp. */
const VENTANA_MS = 24 * 3600_000;

/** Comparación en tiempo constante: con `===` se podría adivinar el secreto midiendo cuánto tarda en fallar. */
function autorizado(header: string | null, secreto: string): boolean {
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(header ?? "");
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

export async function POST(request: Request): Promise<NextResponse> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET sin configurar" }, { status: 503 });
  }
  if (!autorizado(request.headers.get("authorization"), secreto)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const db = createSupabaseDb();
  if (!accessToken || !db) {
    return NextResponse.json({ ok: true, negocios: 0, enviados: 0, nota: "sin WhatsApp o sin base" });
  }

  const ahora = new Date();
  const usoWhatsapp = createWhatsAppUsageRepository();
  let negocios = 0;
  let enviados = 0;

  for (const fila of await db.listNegociosConWhatsapp()) {
    const config = parseBusinessConfig(fila.config);
    if (!config?.seguimientos?.activo || config.botActivo === false || !fila.whatsapp_phone_number_id) continue;
    negocios++;
    try {
      const repo = createLeadRepository(config, fila.id);
      const sesiones = createSessionRepository(config, fila.id);
      const canal = new WhatsAppChannel({
        phoneNumberId: fila.whatsapp_phone_number_id,
        accessToken,
        medidor: { negocio: fila.id ?? config.slug, repo: usoWhatsapp },
      });
      const recientes = (await repo.list(config.slug)).filter(
        (l) => ahora.getTime() - new Date(l.lastInboundAt).getTime() < VENTANA_MS,
      );
      enviados += await procesarSeguimientos(recientes, config, ahora, {
        enviar: async (lead, texto) => {
          await canal.send({ to: lead.contact, text: texto });
          // Queda en el historial para que el bot sepa qué le escribió si el
          // cliente contesta. Aparte y sin lanzar: el mensaje ya salió, y si
          // esto fallara se tomaría como envío fallido y se repetiría.
          try {
            const sesion = await sesiones.getOrCreate(config.slug, lead.contact, lead.channel);
            sesion.history.push({ role: "assistant", text: texto, timestamp: ahora.toISOString() });
            await sesiones.save(sesion);
          } catch (err) {
            console.error("[Seguimientos] no se pudo guardar la sesión:", err);
          }
        },
        guardar: async (lead) => {
          await repo.save(lead);
        },
      });
    } catch (err) {
      // Un negocio con un problema (config, base) no frena a los demás.
      console.error(`[Seguimientos] falló el negocio ${config.slug}:`, err);
    }
  }

  // Resumen del día a la dueña: el mismo cron de cada 15 minutos (así no hay
  // que agregar otro en el VPS). Qué y cuándo lo decide
  // `core/engine/ventas-del-dia.ts`; aquí solo la base y el canal.
  let resumenes = 0;
  const plantillaResumen = process.env.WHATSAPP_TEMPLATE_RESUMEN;
  for (const fila of await db.listNegociosConWhatsapp()) {
    const config = parseBusinessConfig(fila.config);
    if (!config?.resumenDiario?.activo || !fila.whatsapp_phone_number_id || !fila.id) continue;
    const negocioId = fila.id;
    const phoneNumberId = fila.whatsapp_phone_number_id;
    try {
      const salio = await procesarResumenDiario(config, ahora, {
        reclamar: (fecha) => db.reclamarResumenDiario(negocioId, fecha),
        // `items` es jsonb (unknown en el tipo de la fila); ventasDelDia lo lee con cuidado.
        pedidosDesde: async (desde) => (await db.selectPedidosDesde(negocioId, desde.toISOString())) as unknown as PedidoVenta[],
        enviar: async (texto) => {
          // Con plantilla aprobada (WHATSAPP_TEMPLATE_RESUMEN) llega siempre;
          // sin ella, solo si la dueña le escribió al número en las últimas 24 h.
          await new WhatsAppChannel({
            phoneNumberId,
            accessToken,
            medidor: { negocio: negocioId, repo: usoWhatsapp },
            ...(plantillaResumen && {
              plantilla: { nombre: plantillaResumen, idioma: process.env.WHATSAPP_TEMPLATE_IDIOMA ?? "es" },
              forzarPlantilla: true,
            }),
          }).send({
            to: config.notifyPhoneNumber!,
            text: texto,
            // Los parámetros de plantilla no admiten saltos de línea.
            plantillaParams: [texto.replace(/\n+/g, " · ")],
          });
        },
      });
      if (salio) resumenes++;
    } catch (err) {
      console.error(`[Resumen] falló el negocio ${config.slug}:`, err);
    }
  }

  return NextResponse.json({ ok: true, negocios, enviados, resumenes });
}
