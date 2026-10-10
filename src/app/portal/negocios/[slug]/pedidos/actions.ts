"use server";

/**
 * Acciones del panel de pedidos (T-38). La capa web solo verifica permisos y
 * traduce el formulario: las reglas (qué transición vale, contra qué código
 * se entrega, qué se le dice al cliente) viven en el core.
 *
 * El permiso se comprueba leyendo el pedido con el cliente de la DUEÑA (RLS
 * `pedidos_own`): si no lo puede leer, no es suyo. Recién entonces se opera
 * con los repositorios del bot (service role), igual que el webhook.
 */

import { revalidatePath } from "next/cache";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { resolveBusinessBySlug, type ResolvedBusiness } from "@/businesses/resolve";
import { handleOwnerApproval } from "@/core/handle";
import { mensajePedidoListo, validarEntrega } from "@/core/engine/panel-pedidos";
import { transicionarPedido } from "@/core/engine/pedido-estado";
import { BOTON_APROBAR, BOTON_RECHAZAR } from "@/core/engine/approval";
import { toPedido } from "@/core/storage/adapters/supabase/pedidos";
import type { PedidoRow } from "@/core/storage/adapters/supabase/api";
import type { Pedido } from "@/core/storage/pedido-repository";
import {
  createComprobanteRepository,
  createInventoryRepository,
  createLeadRepository,
  createPedidoRepository,
  createWhatsAppUsageRepository,
} from "@/core/storage/factory";
import { WhatsAppChannel } from "@/core/channels/whatsapp/send";
import type { OutgoingMessage } from "@/core/types";
import type { ActionState } from "@/components/action-form";

async function pedidoDeLaDueña(pedidoId: string): Promise<Pedido | null> {
  if (!pedidoId) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.from("pedidos").select("*").eq("id", pedidoId).maybeSingle();
  return data ? toPedido(data as PedidoRow) : null;
}

/** Manda un mensaje al cliente por el número del negocio. Sin token o sin número conectado, no hace nada. */
async function avisarCliente(
  resolved: ResolvedBusiness | null,
  message: OutgoingMessage,
): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = resolved?.whatsappPhoneNumberId;
  if (!accessToken || !phoneNumberId) return;
  try {
    await new WhatsAppChannel({
      phoneNumberId,
      accessToken,
      medidor: { negocio: resolved.negocioId ?? resolved.config.slug, repo: createWhatsAppUsageRepository() },
    }).send(message);
  } catch (err) {
    console.error("[Panel] no se pudo avisar al cliente por WhatsApp:", err);
  }
}

/**
 * Aprobar o rechazar desde el panel. Reusa EXACTAMENTE el camino del botón
 * de WhatsApp (`handleOwnerApproval` con el id del pedido): mismo control de
 * estado, mismo código de retiro, mismo stock devuelto — el panel es otra
 * puerta a la misma decisión, no una lógica paralela.
 */
export async function decidirPedido(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };
  const slug = String(formData.get("slug") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const pedido = await pedidoDeLaDueña(String(formData.get("pedidoId") ?? ""));
  if (!pedido) return { error: "Pedido no encontrado o sin permisos." };

  const resolved = await resolveBusinessBySlug(slug);
  if (!resolved || resolved.negocioId !== pedido.negocio) return { error: "Pedido no encontrado o sin permisos." };
  const config = resolved.config;

  const { ownerReply, customerReply } = await handleOwnerApproval(
    {
      channel: "whatsapp",
      businessSlug: config.slug,
      from: config.notifyPhoneNumber ?? "panel",
      text: "",
      timestamp: new Date().toISOString(),
      botonId: `${decision === "rechazar" ? BOTON_RECHAZAR : BOTON_APROBAR}${pedido.id}`,
    },
    config,
    createLeadRepository(config, resolved.negocioId),
    new Date(),
    createPedidoRepository(),
    resolved.negocioId,
    createComprobanteRepository(),
    createInventoryRepository(),
  );
  if (customerReply) await avisarCliente(resolved, customerReply);

  revalidatePath(`/portal/negocios/${slug}/pedidos`);
  return customerReply ? { ok: ownerReply.text } : { error: ownerReply.text };
}

/** Marca el pedido como listo y le avisa al cliente (listo para recoger, o en camino). */
export async function marcarListo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };
  const slug = String(formData.get("slug") ?? "");
  const pedido = await pedidoDeLaDueña(String(formData.get("pedidoId") ?? ""));
  if (!pedido) return { error: "Pedido no encontrado o sin permisos." };

  try {
    await createPedidoRepository().actualizarEstado(pedido.id, transicionarPedido(pedido.estado, "listo"));
  } catch {
    return { error: `El pedido #${pedido.numero} no está en preparación.` };
  }
  const resolved = await resolveBusinessBySlug(slug);
  await avisarCliente(resolved, { to: pedido.contacto, text: mensajePedidoListo(pedido) });

  revalidatePath(`/portal/negocios/${slug}/pedidos`);
  return { ok: `Pedido #${pedido.numero} listo.` };
}

/** Entrega el pedido SOLO contra el código de retiro que recibió el cliente. */
export async function entregarPedido(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };
  const slug = String(formData.get("slug") ?? "");
  const pedido = await pedidoDeLaDueña(String(formData.get("pedidoId") ?? ""));
  if (!pedido) return { error: "Pedido no encontrado o sin permisos." };

  const resultado = validarEntrega(pedido, String(formData.get("codigo") ?? ""));
  if (!resultado.ok) return { error: resultado.error };

  await createPedidoRepository().actualizarEstado(pedido.id, transicionarPedido(pedido.estado, "entregado"));
  revalidatePath(`/portal/negocios/${slug}/pedidos`);
  return { ok: `Pedido #${pedido.numero} entregado ✅` };
}
