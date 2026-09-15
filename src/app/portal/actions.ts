"use server";

/**
 * Server Actions del portal de clientes.
 *
 * Todas usan el cliente del usuario (cookies): RLS garantiza que un cliente
 * solo puede tocar SUS negocios (defensa en profundidad además del chequeo
 * explícito de cada action). El negocio en sí lo crea el administrador desde
 * el back office (`crearNegocio` en `backoffice/actions.ts`) — el portal solo
 * configura lo que ya existe.
 */

import { revalidatePath } from "next/cache";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { invalidateBusinessCache } from "@/businesses/business-cache";
import { cerrarCitaCumplida } from "@/core/engine/appointment-lifecycle";
import { fromRow, toRow } from "@/core/storage/adapters/supabase/leads";
import type { LeadRow } from "@/core/storage/adapters/supabase/api";
import { createInventoryRepository } from "@/core/storage/factory";
import type { Service } from "@/core/types";

export interface ActionState {
  error?: string;
  ok?: string;
}

export async function actualizarConfig(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };

  const slug = String(formData.get("slug") ?? "");
  const configJson = String(formData.get("config") ?? "");
  if (!slug) return { error: "Falta el negocio." };

  let json: unknown;
  try {
    json = JSON.parse(configJson);
  } catch {
    return { error: "La configuración no es JSON válido." };
  }
  const config = parseBusinessConfig(json);
  if (!config) return { error: "La configuración no cumple la forma esperada." };

  // El slug del motor no se cambia desde el editor (identifica leads/sesiones).
  config.slug = slug;

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("id");
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!data?.length) return { error: "Negocio no encontrado o sin permisos." };

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}`);
  revalidatePath(`/portal/negocios/${slug}/editar`);
  return { ok: "Configuración guardada. El bot ya responde con estos cambios." };
}

/** Claves de la config que los editores del portal pueden modificar. */
const PATCH_KEYS = [
  "services",
  "horarios",
  "ai",
  "direccion",
  "personas",
  "messages",
  "pedidos",
  "notifyPhoneNumber",
] as const;

/**
 * Guarda una sección de la config del negocio (catálogo, citas, respuestas,
 * configuración). Recibe un patch JSON con un subconjunto de claves permitidas,
 * lo mezcla sobre la config actual y valida el resultado completo con Zod.
 */
export async function guardarConfigParcial(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };

  const slug = String(formData.get("slug") ?? "");
  const patchJson = String(formData.get("patch") ?? "");
  if (!slug) return { error: "Falta el negocio." };

  let patch: Record<string, unknown>;
  try {
    patch = JSON.parse(patchJson) as Record<string, unknown>;
  } catch {
    return { error: "Los cambios no son JSON válido." };
  }

  const supabase = await createUserClient();
  const { data: negocio } = await supabase
    .from("negocios")
    .select("config")
    .eq("slug", slug)
    .maybeSingle();
  const actual = parseBusinessConfig(negocio?.config);
  if (!actual) return { error: "Negocio no encontrado o config inválida." };

  const merged: Record<string, unknown> = { ...actual };
  for (const key of PATCH_KEYS) {
    if (key in patch) merged[key] = patch[key];
  }

  const config = parseBusinessConfig(merged);
  if (!config) return { error: "Los cambios no cumplen la forma esperada." };
  config.slug = slug; // el slug del motor nunca cambia desde los editores

  const { data, error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("id");
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!data?.length) return { error: "Negocio no encontrado o sin permisos." };

  // T-21: si el patch tocó el catálogo, el stock que el dueño haya escrito
  // ahí se sincroniza a `inventario` (la tabla que descuenta atómicamente al
  // confirmar un pedido) — ver migración 0010. Es lo que hace que "editar
  // stock por ítem" sea, sencillamente, el mismo campo que ya existe en el
  // editor de catálogo desde T-21/PR2, sin una pantalla aparte.
  if ("services" in patch) {
    await sincronizarStock(data[0].id, config.services).catch((err) => {
      // No bloquea el guardado: el catálogo YA se guardó bien. Sin stock
      // sincronizado, el peor caso es que ese producto quede "sin límite"
      // hasta el próximo guardado — nunca que el guardado en sí falle.
      console.error("[inventario] no se pudo sincronizar el stock:", err);
    });
  }

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}`, "layout");
  return { ok: "Guardado. El bot ya responde con estos cambios." };
}

/**
 * Sincroniza `service.stock` (lo que el dueño escribió en el catálogo) a la
 * tabla `inventario`. Solo toca los ítems que declaran `stock` — uno sin ese
 * campo sigue "sin límite", nunca se crea una fila para él (ver migración
 * 0010: sin fila = sin control de stock).
 */
async function sincronizarStock(negocioId: string, services: Service[]): Promise<void> {
  const inventory = createInventoryRepository();
  await Promise.all(
    services
      .filter((s) => s.stock !== undefined)
      .map((s) => inventory.setStock(negocioId, s.id, s.stock!)),
  );
}

/** Toggle "Bot activo / Pausa" de la topbar del panel. */
export async function toggleBotActivo(formData: FormData): Promise<void> {
  const me = await getUserRole();
  if (!me) return;

  const slug = String(formData.get("slug") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!slug) return;

  const supabase = await createUserClient();
  const { data: negocio } = await supabase
    .from("negocios")
    .select("config")
    .eq("slug", slug)
    .maybeSingle();
  const config = parseBusinessConfig(negocio?.config);
  if (!config) return;

  config.botActivo = next;
  await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}`, "layout");
}

/**
 * Cierre manual de una cita ya cumplida (T-20), desde la sección Citas del
 * portal. Reutiliza `cerrarCitaCumplida` (`core/engine/appointment-lifecycle.ts`)
 * — la misma función que usa el cierre automático — así "cerrar una cita"
 * tiene una sola definición, la use el camino automático o el manual.
 *
 * Usa `createUserClient()` (no la service role del bot): RLS
 * (`leads_own`/`leads_own_update`, migración 0008) garantiza que el dueño
 * solo pueda leer y cerrar leads de SUS propios negocios.
 */
export async function marcarAtendido(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };

  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return { error: "Falta la cita." };

  const supabase = await createUserClient();
  const { data: row } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (!row) return { error: "Cita no encontrada o sin permisos." };

  const lead = fromRow(row as LeadRow);
  if (lead.stage !== "datos_completos") {
    return { error: "Esta cita no está confirmada, no hay nada que cerrar." };
  }

  let cerrado;
  try {
    cerrado = cerrarCitaCumplida(lead, new Date());
  } catch (err) {
    return { error: `No se pudo cerrar la cita: ${err instanceof Error ? err.message : String(err)}` };
  }

  const { data, error } = await supabase
    .from("leads")
    .update(toRow(cerrado, (row as LeadRow).negocio_id ?? undefined))
    .eq("id", leadId)
    .select("id");
  if (error) return { error: `No se pudo cerrar la cita: ${error.message}` };
  if (!data?.length) return { error: "Cita no encontrada o sin permisos." };

  revalidatePath(`/portal/negocios/${lead.businessSlug}/citas`);
  return { ok: "Cita marcada como atendida." };
}

export async function actualizarWhatsapp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };

  const slug = String(formData.get("slug") ?? "");
  const phoneNumberId = String(formData.get("whatsapp_phone_number_id") ?? "").trim();
  if (!slug) return { error: "Falta el negocio." };

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("negocios")
    .update({
      whatsapp_phone_number_id: phoneNumberId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .select("id");
  if (error) {
    return {
      error: error.code === "23505"
        ? "Ese phone_number_id ya está en uso por otro negocio."
        : `No se pudo guardar: ${error.message}`,
    };
  }
  if (!data?.length) return { error: "Negocio no encontrado o sin permisos." };

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}/editar`);
  return { ok: "Conexión de WhatsApp actualizada." };
}
