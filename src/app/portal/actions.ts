"use server";

/**
 * Server Actions del portal de clientes.
 *
 * Todas usan el cliente del usuario (cookies): RLS garantiza que un cliente
 * solo puede tocar SUS negocios y crear solo desde rubros que tiene asignados
 * (además del chequeo explícito aquí — defensa en profundidad).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import type { BusinessConfig } from "@/core/types";

export interface ActionState {
  error?: string;
  ok?: string;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function crearNegocio(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };

  const rubroId = String(formData.get("rubro_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();

  if (!rubroId || !nombre) return { error: "Elige un rubro y un nombre." };
  if (!SLUG_RE.test(slug)) {
    return { error: "El slug debe ir en kebab-case (ej. mi-negocio)." };
  }

  const supabase = await createUserClient();

  // El rubro debe estar asignado al usuario (RLS también lo exige en el insert).
  const { data: asignacion } = await supabase
    .from("asignaciones")
    .select("id, rubros(template)")
    .eq("rubro_id", rubroId)
    .eq("user_id", me.userId)
    .maybeSingle();
  if (!asignacion) return { error: "Ese rubro no está asignado a tu cuenta." };

  const rubro = asignacion.rubros as unknown as { template: unknown } | null;
  const template = parseBusinessConfig(rubro?.template);
  if (!template) {
    return { error: "La plantilla del rubro es inválida; contacta al administrador." };
  }

  // El negocio nace como copia de la plantilla, con su propio slug y nombre.
  const config: BusinessConfig = { ...template, slug, name: nombre };

  const { error } = await supabase.from("negocios").insert({
    owner_id: me.userId,
    rubro_id: rubroId,
    slug,
    config,
  });
  if (error) {
    return {
      error: error.code === "23505"
        ? "Ya existe un negocio con ese slug; elige otro."
        : `No se pudo crear el negocio: ${error.message}`,
    };
  }

  revalidatePath("/portal");
  redirect(`/portal/negocios/${slug}`);
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

  revalidatePath(`/portal/negocios/${slug}/editar`);
  return { ok: "Conexión de WhatsApp actualizada." };
}
