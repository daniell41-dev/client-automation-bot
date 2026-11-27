"use server";

/**
 * T-114 (temporal, para las demostraciones con Sabores del Sur): "Enviar
 * ahora" del seguimiento automático. Le manda YA el primer mensaje a un
 * cliente con un pedido a medias, para que vea cómo llega sin esperar los
 * minutos configurados. Reemplaza al "Enviarme una prueba" de T-112, que le
 * escribía a la dueña: en una demo el que tiene que recibirlo es el cliente.
 *
 * Qué se manda y a quién se le puede escribir lo decide el core
 * (`seguimientoAhora`); aquí solo se verifican permisos, se envía y se anota.
 */

import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { resolveBusinessBySlug } from "@/businesses/resolve";
import { seguimientoAhora } from "@/core/engine/seguimientos";
import { WhatsAppChannel } from "@/core/channels/whatsapp/send";
import {
  createLeadRepository,
  createSessionRepository,
  createWhatsAppUsageRepository,
} from "@/core/storage/factory";
import type { ActionState } from "@/components/action-form";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.configuracion). */
const tt = textos.acciones.configuracion;

/** Un envío cada 30 s por cliente: un doble clic no debe mandarle dos mensajes. */
const ESPERA_MS = 30_000;
const ultimoEnvio = new Map<string, number>();

export async function enviarSeguimientoAhora(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };
  const slug = String(formData.get("slug") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  if (!slug) return { error: tt.faltaElNegocio };
  if (!leadId) return { error: tt.elijaAQueCliente };

  // El permiso: si la dueña no puede leer el negocio con SU sesión (RLS), no es suyo.
  const supabase = await createUserClient();
  const { data: propio } = await supabase.from("negocios").select("id").eq("slug", slug).maybeSingle();
  if (!propio) return { error: tt.negocioNoEncontradoO };

  const resolved = await resolveBusinessBySlug(slug);
  const config = resolved?.config;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!config || !accessToken || !resolved.whatsappPhoneNumberId) {
    return { error: tt.esteNegocioTodaviaNo };
  }

  const repo = createLeadRepository(config, resolved.negocioId);
  const lead = await repo.getById(leadId);
  // El id viene del formulario: se confirma que el cliente es de ESTE negocio.
  if (!lead || lead.businessSlug !== config.slug) return { error: tt.clienteNoEncontrado };

  const ahora = new Date();
  const decision = seguimientoAhora(lead, config, String(formData.get("primero") ?? ""), ahora);
  if (!decision) {
    return { error: tt.aEsteClienteYa };
  }
  if (ahora.getTime() - (ultimoEnvio.get(leadId) ?? 0) < ESPERA_MS) {
    return { error: tt.yaSeLeMando };
  }
  ultimoEnvio.set(leadId, ahora.getTime());

  try {
    await new WhatsAppChannel({
      phoneNumberId: resolved.whatsappPhoneNumberId,
      accessToken,
      medidor: { negocio: resolved.negocioId ?? config.slug, repo: createWhatsAppUsageRepository() },
    }).send({ to: lead.contact, text: decision.texto });
  } catch (err) {
    console.error("[Seguimientos] el envío a mano no salió:", err);
    return { error: tt.whatsappNoAceptoEl };
  }

  // Ya salió: lo que sigue no debe convertirse en "falló" (se reenviaría).
  try {
    await repo.save(decision.lead);
    const sesiones = createSessionRepository(config, resolved.negocioId);
    const sesion = await sesiones.getOrCreate(config.slug, lead.contact, lead.channel);
    sesion.history.push({ role: "assistant", text: decision.texto, timestamp: ahora.toISOString() });
    await sesiones.save(sesion);
  } catch (err) {
    console.error("[Seguimientos] se envió a mano pero no se pudo anotar:", err);
  }
  return { ok: tt.enviadoAlClienteYa };
}
