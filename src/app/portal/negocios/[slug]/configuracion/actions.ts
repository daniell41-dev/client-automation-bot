"use server";

/**
 * T-112: "Enviarme una prueba" del seguimiento automático. Manda YA el
 * primer mensaje al WhatsApp de Notificaciones de la dueña, para que vea
 * cómo queda sin esperar 2 horas ni escribirle a un cliente real. El texto
 * lo arma el core (`textoDePrueba`); aquí solo se verifican permisos y se
 * envía.
 *
 * Solo al número de Notificaciones YA GUARDADO, nunca a uno escrito en el
 * formulario: si no, el botón serviría para escribirle a cualquier número
 * desde la línea del negocio.
 */

import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { resolveBusinessBySlug } from "@/businesses/resolve";
import { textoDePrueba } from "@/core/engine/seguimientos";
import { WhatsAppChannel } from "@/core/channels/whatsapp/send";
import { createLeadRepository, createWhatsAppUsageRepository } from "@/core/storage/factory";
import type { ActionState } from "@/components/action-form";

/** Una prueba cada 30 s por negocio: un doble clic no debe mandar dos mensajes. */
const ESPERA_MS = 30_000;
const ultimaPrueba = new Map<string, number>();

export async function probarSeguimiento(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: "Falta el negocio." };

  // El permiso: si la dueña no puede leer el negocio con SU sesión (RLS), no es suyo.
  const supabase = await createUserClient();
  const { data: propio } = await supabase.from("negocios").select("id").eq("slug", slug).maybeSingle();
  if (!propio) return { error: "Negocio no encontrado o sin permisos." };

  const resolved = await resolveBusinessBySlug(slug);
  const config = resolved?.config;
  const destino = config?.notifyPhoneNumber?.replace(/\D/g, "");
  if (!config || !destino) {
    return { error: "Primero guarde su número de WhatsApp en «Notificaciones» (más abajo)." };
  }
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken || !resolved.whatsappPhoneNumberId) {
    return { error: "Este negocio todavía no tiene WhatsApp conectado." };
  }

  const ahora = Date.now();
  if (ahora - (ultimaPrueba.get(slug) ?? 0) < ESPERA_MS) {
    return { error: "Ya se mandó una prueba hace un momento. Espere unos segundos." };
  }
  ultimaPrueba.set(slug, ahora);

  // El texto que está en el cuadro aunque no se haya guardado: es lo que la dueña quiere ver.
  const plantilla = String(formData.get("primero") ?? "");
  const lead = await createLeadRepository(config, resolved.negocioId)
    .findByContact(config.slug, destino)
    .catch(() => null);
  const texto = textoDePrueba(plantilla, lead, config);

  try {
    await new WhatsAppChannel({
      phoneNumberId: resolved.whatsappPhoneNumberId,
      accessToken,
      medidor: { negocio: resolved.negocioId ?? config.slug, repo: createWhatsAppUsageRepository() },
    }).send({ to: destino, text: texto });
  } catch (err) {
    console.error("[Seguimientos] la prueba no salió:", err);
    return { error: "WhatsApp no aceptó el mensaje. Revise el número de Notificaciones e intente de nuevo." };
  }
  // Meta acepta el envío aunque la ventana de 24 h esté cerrada y lo descarta
  // después, así que aquí no se puede saber: se le dice qué hacer si no llega.
  return {
    ok: "Prueba enviada a su WhatsApp. Si no le llega en un minuto, escríbale cualquier cosa al bot desde ese número y vuelva a intentar.",
  };
}
