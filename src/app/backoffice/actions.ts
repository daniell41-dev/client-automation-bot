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
import { linkDefinirContrasena } from "@/lib/sitio";
import { redirect } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBusinessConfig } from "@/core/config-schema";
import { planDe } from "@/core/planes";
import { plantilla } from "@/businesses/_template/config";
import { invalidateBusinessCache } from "@/businesses/business-cache";
import { actualizarNegocioSchema, crearNegocioSchema } from "@/app/backoffice/negocio-schema";
import { crearRubroSchema } from "@/app/backoffice/rubro-schema";
import { createInventoryRepository } from "@/core/storage/factory";
import type { BusinessConfig } from "@/core/types";
import { formato, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.backoffice). */
const tt = textos.acciones.backoffice;

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireAdmin(): Promise<string | null> {
  const me = await getUserRole();
  if (!me || me.role !== "admin") return tt.noAutorizado;
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
    return formato(tt.noSePudoAsignar, { message: error.message });
  }
  return null;
}

// ── Negocios ─────────────────────────────────────────────────────────────────

/**
 * T-127: si la base todavía no tiene la columna `plan` (migración 0032 sin
 * aplicar), Postgres/PostgREST responden con un error de columna inexistente
 * que no le dice nada al admin. Se traduce a qué hacer.
 */
function errorDePlan(error: { code?: string; message: string }): string | null {
  const sinColumna = error.code === "42703" || error.code === "PGRST204" || /column .*plan/i.test(error.message);
  return sinColumna ? tt.faltaAplicarLaMigracion : null;
}

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
    plan: planDe(formData.get("plan")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? tt.datosInvalidos };
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
    return { error: tt.laPlantillaDeEse };
  }

  // Nace Pausado: el admin lo activa cuando el negocio esté listo para atender.
  const config: BusinessConfig = { ...template, slug, name: nombre, botActivo: false };

  const { data: negocio, error } = await supabase
    .from("negocios")
    .insert({
      owner_id: ownerId,
      rubro_id: rubroId,
      slug,
      config,
      whatsapp_phone_number_id: whatsapp || null,
      // T-127: el plan es una columna propia (migración 0032), no va en el config.
      plan,
    })
    .select("id")
    .single();
  if (error) {
    return {
      error:
        error.code === "23505"
          ? tt.yaExisteUnNegocio
          : errorDePlan(error) ?? formato(tt.noSePudoCrear, { message: error.message }),
    };
  }

  const asignacionError = await asegurarAsignacion(supabase, ownerId, rubroId);
  if (asignacionError) return { error: asignacionError };

  // T-21: si el rubro trae ítems con stock precargado (ej. un rubro de
  // tienda), el negocio nuevo arranca protegido de una — sin esto, el dueño
  // tendría que abrir y volver a guardar el catálogo una vez antes de que el
  // stock empezara a controlarse (ver `sincronizarStock` en portal/actions.ts).
  const inventory = createInventoryRepository();
  await Promise.all(
    config.services
      .filter((s) => s.stock !== undefined)
      .map((s) => inventory.setStock(negocio.id, s.id, s.stock!)),
  ).catch((err) => console.error("[inventario] no se pudo precargar el stock inicial:", err));

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
    plan: planDe(formData.get("plan")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? tt.datosInvalidos };
  }
  const { id, nombre, owner_id: ownerId, whatsapp_phone_number_id: whatsapp, plan } = parsed.data;

  const supabase = await createUserClient();
  const { data: actual } = await supabase
    .from("negocios")
    .select("rubro_id, config")
    .eq("id", id)
    .maybeSingle();
  const config = parseBusinessConfig(actual?.config);
  if (!actual || !config) return { error: tt.negocioNoEncontradoO };

  const nuevaConfig: BusinessConfig = { ...config, name: nombre };

  const { error } = await supabase
    .from("negocios")
    .update({
      owner_id: ownerId,
      config: nuevaConfig,
      whatsapp_phone_number_id: whatsapp || null,
      plan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? tt.eseWhatsappYaEsta
          : errorDePlan(error) ?? formato(tt.noSePudoGuardar, { message: error.message }),
    };
  }

  // Si se transfirió a otro cliente, ese cliente necesita el rubro asignado
  // para poder verlo/gestionarlo en su /portal.
  const asignacionError = await asegurarAsignacion(supabase, ownerId, actual.rubro_id);
  if (asignacionError) return { error: asignacionError };

  invalidateBusinessCache();
  revalidatePath("/backoffice/negocios");
  revalidatePath(`/backoffice/negocios/${id}`);
  return { ok: tt.negocioActualizado };
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
  if (!id) return { error: tt.faltaElNegocio };

  const supabase = await createUserClient();
  const { error } = await supabase.from("negocios").delete().eq("id", id);
  if (error) return { error: formato(tt.noSePudoEliminar, { message: error.message }) };

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
    return { error: tt.correoRequeridoYContrasena };
  }
  if (!["admin", "cliente", "invitado"].includes(role)) {
    return { error: tt.rolInvalido };
  }

  const admin = createAdminClient();
  if (!admin) return { error: tt.supabaseNoEstaConfigurado };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return { error: formato(tt.noSePudoCrear2, { message: error.message }) };

  // El trigger creó el profile con rol 'cliente'; se ajusta si difiere.
  if (role !== "cliente" && data.user) {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleError) return { error: formato(tt.usuarioCreadoPeroSin, { message: roleError.message }) };
  }

  revalidatePath("/backoffice/usuarios");
  return { ok: formato(tt.usuarioEmailCreado, { email }) };
}

/**
 * T-41: invita a una dueña por correo. Supabase le manda un link; al
 * tocarlo define su propia contraseña (`/cuenta/contrasena`) — el admin ya
 * no inventa ni pasa contraseñas por WhatsApp. Los rubros marcados quedan
 * asignados: son los tipos de negocio entre los que ella va a poder elegir
 * en su primer ingreso (T-42).
 */
export async function invitarDuena(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const rubroIds = formData.getAll("rubroIds").map(String).filter(Boolean);
  if (!email.includes("@")) return { error: tt.escribaUnCorreoValido };
  if (rubroIds.length === 0) return { error: tt.marqueAlMenosUn };

  const admin = createAdminClient();
  if (!admin) return { error: tt.supabaseNoEstaConfigurado };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: await linkDefinirContrasena(),
  });
  if (error || !data.user) {
    return { error: formato(tt.noSePudoInvitar, { motivo: error?.message ?? tt.sinUsuario }) };
  }

  const { error: asignError } = await admin
    .from("asignaciones")
    .upsert(
      rubroIds.map((rubroId) => ({ user_id: data.user!.id, rubro_id: rubroId })),
      { onConflict: "user_id,rubro_id", ignoreDuplicates: true },
    );
  if (asignError) return { error: formato(tt.invitacionEnviadaPeroSin, { message: asignError.message }) };

  revalidatePath("/backoffice/usuarios");
  return { ok: formato(tt.invitacionEnviadaAEmail, { email }) };
}

// ── Rubros ───────────────────────────────────────────────────────────────────

export async function crearRubro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const parsed = crearRubroSchema.safeParse({
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    nombre: String(formData.get("nombre") ?? "").trim(),
    descripcion: String(formData.get("descripcion") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? tt.datosInvalidos };
  }
  const { slug, nombre, descripcion } = parsed.data;
  const templateJson = String(formData.get("template") ?? "");

  // Sin plantilla explícita, el rubro nace con la plantilla base del código
  // (el admin la personaliza después en el editor del rubro). Las DOS ramas
  // pasan por Zod: antes esta segunda insertaba `{ ...plantilla, slug, name }`
  // directo, así que un slug que no fuera kebab-case entraba a la base dentro
  // del template y recién explotaba al crear un negocio, con un error que
  // apuntaba al lugar equivocado ("La plantilla de ese rubro es inválida").
  let template: unknown;
  if (templateJson) {
    try {
      template = JSON.parse(templateJson);
    } catch {
      return { error: tt.laPlantillaNoEs };
    }
  } else {
    template = { ...plantilla, slug, name: nombre };
  }
  if (!parseBusinessConfig(template)) {
    return { error: tt.laPlantillaNoCumple };
  }

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("rubros")
    .insert({ slug, nombre, descripcion: descripcion || null, template });
  if (error) return { error: formato(tt.noSePudoCrear3, { message: error.message }) };

  revalidatePath("/backoffice/rubros");
  return { ok: formato(tt.rubroNombreCreado, { nombre }) };
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
  if (!id || !nombre) return { error: tt.faltanDatosDelRubro };

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("rubros")
    .update({
      nombre,
      descripcion: descripcion || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: formato(tt.noSePudoActualizar, { message: error.message }) };

  revalidatePath("/backoffice/rubros");
  revalidatePath(`/backoffice/rubros/${id}`);
  return { ok: tt.datosDelRubroActualizados };
}

export async function actualizarRubroTemplate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "");
  const templateJson = String(formData.get("template") ?? "");
  if (!id) return { error: tt.faltaElIdDel };

  let template: unknown;
  try {
    template = JSON.parse(templateJson);
  } catch {
    return { error: tt.laPlantillaNoEs };
  }
  if (!parseBusinessConfig(template)) {
    return { error: tt.laPlantillaNoCumple };
  }

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("rubros")
    .update({ template, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: formato(tt.noSePudoActualizar, { message: error.message }) };

  revalidatePath(`/backoffice/rubros/${id}`);
  return { ok: tt.plantillaActualizada };
}

export async function eliminarRubro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: tt.faltaElRubro };

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
          ? tt.noSePuedeEliminar
          : formato(tt.noSePudoEliminar, { message: error.message }),
    };
  }

  revalidatePath("/backoffice/rubros");
  return { ok: tt.plantillaEliminada };
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
  if (!userId || !rubroId) return { error: tt.elijaUsuarioYRubro };

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("asignaciones")
    .insert({ user_id: userId, rubro_id: rubroId });
  if (error) {
    return {
      error: error.code === "23505"
        ? tt.eseRubroYaEsta
        : formato(tt.noSePudoAsignar2, { message: error.message }),
    };
  }

  revalidatePath("/backoffice/asignaciones");
  return { ok: tt.rubroAsignado };
}

export async function quitarAsignacion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: tt.faltaLaAsignacion };

  const supabase = await createUserClient();
  const { error } = await supabase.from("asignaciones").delete().eq("id", id);
  if (error) return { error: formato(tt.noSePudoQuitar, { message: error.message }) };

  revalidatePath("/backoffice/asignaciones");
  return { ok: tt.asignacionQuitada };
}
