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

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}`, "layout");
  return { ok: "Guardado. El bot ya responde con estos cambios." };
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
