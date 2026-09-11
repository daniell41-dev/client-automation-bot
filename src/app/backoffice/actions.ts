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
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBusinessConfig } from "@/core/config-schema";
import { plantilla } from "@/businesses/_template/config";

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireAdmin(): Promise<string | null> {
  const me = await getUserRole();
  if (!me || me.role !== "admin") return "No autorizado.";
  return null;
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

export async function eliminarRubro(formData: FormData): Promise<void> {
  const denied = await requireAdmin();
  if (denied) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createUserClient();
  await supabase.from("rubros").delete().eq("id", id);
  revalidatePath("/backoffice/rubros");
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

export async function quitarAsignacion(formData: FormData): Promise<void> {
  const denied = await requireAdmin();
  if (denied) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createUserClient();
  await supabase.from("asignaciones").delete().eq("id", id);
  revalidatePath("/backoffice/asignaciones");
}
