"use server";

/**
 * Server Actions del back office (solo admin).
 *
 * Cada action re-verifica el rol server-side (defensa en profundidad: además
 * de RLS y del guard del layout, una action invocada directamente tampoco
 * puede saltarse el rol). Las mutaciones de datos usan el cliente del usuario
 * (RLS admin); solo crear usuarios requiere la service role key.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBusinessConfig } from "@/core/config-schema";
import { plantilla } from "@/businesses/_template/config";
import { invalidateBusinessCache } from "@/businesses/business-cache";
import { actualizarNegocioSchema, crearNegocioSchema } from "@/app/backoffice/negocio-schema";
import type { BusinessConfig } from "@/core/types";

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireAdmin(): Promise<string | null> {
  const me = await getUserRole();
  if (!me || me.role !== "admin") return "No autorizado.";
  return null;
}

/**
 * Asegura que el cliente dueño tenga el rubro asignado — sin esto, RLS
 * (`rubros_asignados`/`negocios_own`) le deja el negocio invisible en su
 * propio `/portal` apenas lo creamos. Idempotente: si ya existe, la
 * violación de `unique (user_id, rubro_id)` se ignora a propósito.
 */
async function asegurarAsignacion(
  supabase: Awaited<ReturnType<typeof createUserClient>>,
  userId: string,
  rubroId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("asignaciones")
    .insert({ user_id: userId, rubro_id: rubroId });
  if (error && error.code !== "23505") {
    return `No se pudo asignar el rubro al cliente: ${error.message}`;
  }
  return null;
}

// ── Negocios ─────────────────────────────────────────────────────────────────

export async function crearNegocio(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const parsed = crearNegocioSchema.safeParse({
    nombre: String(formData.get("nombre") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    owner_id: String(formData.get("owner_id") ?? ""),
    rubro_id: String(formData.get("rubro_id") ?? ""),
    whatsapp_phone_number_id: String(formData.get("whatsapp_phone_number_id") ?? "").trim(),
    plan: String(formData.get("plan") ?? "free") === "pro" ? "pro" : "free",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const {
    nombre,
    slug,
    owner_id: ownerId,
    rubro_id: rubroId,
    whatsapp_phone_number_id: whatsapp,
    plan,
  } = parsed.data;

  const supabase = await createUserClient();

  const { data: rubro } = await supabase
    .from("rubros")
    .select("template")
    .eq("id", rubroId)
    .maybeSingle();
  const template = parseBusinessConfig(rubro?.template);
  if (!template) {
    return { error: "La plantilla de ese rubro es inválida; revisala en Rubros." };
  }

  // Nace Pausado: el admin lo activa cuando el negocio esté listo para atender.
  const config: BusinessConfig = { ...template, slug, name: nombre, botActivo: false, plan };

  const { data: negocio, error } = await supabase
    .from("negocios")
    .insert({
      owner_id: ownerId,
      rubro_id: rubroId,
      slug,
      config,
      whatsapp_phone_number_id: whatsapp || null,
    })
    .select("id")
    .single();
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un negocio con ese slug o ese WhatsApp; elegí otro."
          : `No se pudo crear el negocio: ${error.message}`,
    };
  }

  const asignacionError = await asegurarAsignacion(supabase, ownerId, rubroId);
  if (asignacionError) return { error: asignacionError };

  invalidateBusinessCache();
  revalidatePath("/backoffice/negocios");
  redirect(`/backoffice/negocios/${negocio.id}`);
}

export async function actualizarNegocio(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const parsed = actualizarNegocioSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    nombre: String(formData.get("nombre") ?? "").trim(),
    owner_id: String(formData.get("owner_id") ?? ""),
    whatsapp_phone_number_id: String(formData.get("whatsapp_phone_number_id") ?? "").trim(),
    plan: String(formData.get("plan") ?? "free") === "pro" ? "pro" : "free",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { id, nombre, owner_id: ownerId, whatsapp_phone_number_id: whatsapp, plan } = parsed.data;

  const supabase = await createUserClient();
  const { data: actual } = await supabase
    .from("negocios")
    .select("rubro_id, config")
    .eq("id", id)
    .maybeSingle();
  const config = parseBusinessConfig(actual?.config);
  if (!actual || !config) return { error: "Negocio no encontrado o config inválida." };

  const nuevaConfig: BusinessConfig = { ...config, name: nombre, plan };

  const { error } = await supabase
    .from("negocios")
    .update({
      owner_id: ownerId,
      config: nuevaConfig,
      whatsapp_phone_number_id: whatsapp || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ese WhatsApp ya está en uso por otro negocio."
          : `No se pudo guardar: ${error.message}`,
    };
  }

  // Si se transfirió a otro cliente, ese cliente necesita el rubro asignado
  // para poder verlo/gestionarlo en su /portal.
  const asignacionError = await asegurarAsignacion(supabase, ownerId, actual.rubro_id);
  if (asignacionError) return { error: asignacionError };

  invalidateBusinessCache();
  revalidatePath("/backoffice/negocios");
  revalidatePath(`/backoffice/negocios/${id}`);
  return { ok: "Negocio actualizado." };
}

/** Pausar/Activar bot desde el detalle del negocio (equivalente admin del toggle del portal). */
export async function toggleBotActivoNegocio(formData: FormData): Promise<void> {
  const denied = await requireAdmin();
  if (denied) return;

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!id) return;

  const supabase = await createUserClient();
  const { data: negocio } = await supabase
    .from("negocios")
    .select("config")
    .eq("id", id)
    .maybeSingle();
  const config = parseBusinessConfig(negocio?.config);
  if (!config) return;

  config.botActivo = next;
  await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", id);

  invalidateBusinessCache();
  revalidatePath(`/backoffice/negocios/${id}`);
  revalidatePath("/backoffice/negocios");
}

export async function eliminarNegocio(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el negocio." };

  const supabase = await createUserClient();
  const { error } = await supabase.from("negocios").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  invalidateBusinessCache();
  revalidatePath("/backoffice/negocios");
  redirect("/backoffice/negocios");
}

// ── Usuarios ─────────────────────────────────────────────────────────────────

export async function crearUsuario(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "cliente");

  if (!email || password.length < 8) {
    return { error: "Correo requerido y contraseña de mínimo 8 caracteres." };
  }
  if (!["admin", "cliente", "invitado"].includes(role)) {
    return { error: "Rol inválido." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "Supabase no está configurado." };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return { error: `No se pudo crear el usuario: ${error.message}` };

  // El trigger creó el profile con rol 'cliente'; se ajusta si difiere.
  if (role !== "cliente" && data.user) {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleError) return { error: `Usuario creado pero sin rol: ${roleError.message}` };
  }

  revalidatePath("/backoffice/usuarios");
  return { ok: `Usuario ${email} creado.` };
}

// ── Rubros ───────────────────────────────────────────────────────────────────

export async function crearRubro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const slug = String(formData.get("slug") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const templateJson = String(formData.get("template") ?? "");

  if (!slug || !nombre) return { error: "Slug y nombre son obligatorios." };

  // Sin plantilla explícita, el rubro nace con la plantilla base del código
  // (el admin la personaliza después en el editor del rubro).
  let template: unknown;
  if (templateJson) {
    try {
      template = JSON.parse(templateJson);
    } catch {
      return { error: "La plantilla no es JSON válido." };
    }
    if (!parseBusinessConfig(template)) {
      return { error: "La plantilla no cumple la forma de BusinessConfig." };
    }
  } else {
    template = { ...plantilla, slug, name: nombre };
  }

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("rubros")
    .insert({ slug, nombre, descripcion: descripcion || null, template });
  if (error) return { error: `No se pudo crear el rubro: ${error.message}` };

  revalidatePath("/backoffice/rubros");
  return { ok: `Rubro "${nombre}" creado.` };
}

export async function actualizarRubroMeta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (!id || !nombre) return { error: "Faltan datos del rubro." };

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("rubros")
    .update({
      nombre,
      descripcion: descripcion || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/backoffice/rubros");
  revalidatePath(`/backoffice/rubros/${id}`);
  return { ok: "Datos del rubro actualizados." };
}

export async function actualizarRubroTemplate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "");
  const templateJson = String(formData.get("template") ?? "");
  if (!id) return { error: "Falta el id del rubro." };

  let template: unknown;
  try {
    template = JSON.parse(templateJson);
  } catch {
    return { error: "La plantilla no es JSON válido." };
  }
  if (!parseBusinessConfig(template)) {
    return { error: "La plantilla no cumple la forma de BusinessConfig." };
  }

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("rubros")
    .update({ template, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/backoffice/rubros/${id}`);
  return { ok: "Plantilla actualizada." };
}

export async function eliminarRubro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el rubro." };

  const supabase = await createUserClient();
  const { error } = await supabase.from("rubros").delete().eq("id", id);
  if (error) {
    return {
      // 23503 = foreign_key_violation: el diálogo ya avisa esto ANTES de
      // confirmar (ver rubros/page.tsx), pero la situación pudo cambiar
      // entre que se abrió y se confirmó — nunca se confía solo en el chequeo
      // del cliente.
      error:
        error.code === "23503"
          ? "No se puede eliminar: todavía tiene negocios asociados."
          : `No se pudo eliminar: ${error.message}`,
    };
  }

  revalidatePath("/backoffice/rubros");
  return { ok: "Plantilla eliminada." };
}

// ── Asignaciones ─────────────────────────────────────────────────────────────

export async function asignarRubro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const userId = String(formData.get("user_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  if (!userId || !rubroId) return { error: "Elige usuario y rubro." };

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("asignaciones")
    .insert({ user_id: userId, rubro_id: rubroId });
  if (error) {
    return {
      error: error.code === "23505"
        ? "Ese rubro ya está asignado a ese usuario."
        : `No se pudo asignar: ${error.message}`,
    };
  }

  revalidatePath("/backoffice/asignaciones");
  return { ok: "Rubro asignado." };
}

export async function quitarAsignacion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta la asignación." };

  const supabase = await createUserClient();
  const { error } = await supabase.from("asignaciones").delete().eq("id", id);
  if (error) return { error: `No se pudo quitar: ${error.message}` };

  revalidatePath("/backoffice/asignaciones");
  return { ok: "Asignación quitada." };
}
