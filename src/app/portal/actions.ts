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
import { createAdminClient } from "@/lib/supabase/admin";
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
  "pagos",
  "avisos",
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

/**
 * Guarda las credenciales de Wompi (T-24.6). Van en columnas propias de
 * `negocios` — nunca en `config` — porque `configuracion/page.tsx` selecciona
 * `config` entero y se lo pasa a un componente cliente para editarlo; ahí
 * adentro cualquier secreto quedaría visible en el navegador (ver el
 * comentario largo en `types.ts#PagosConfig.wompi` y la migración 0014).
 *
 * Por eso esta action NUNCA lee las credenciales existentes de vuelta — el
 * formulario siempre arranca vacío — y solo actualiza los campos que vengan
 * con contenido: dejar uno en blanco no borra lo que ya estaba guardado, así
 * el dueño puede rotar una sola llave sin tener a mano las otras dos.
 */
export async function actualizarWompi(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };

  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: "Falta el negocio." };

  const campos: Record<string, string> = {
    wompi_public_key: "public_key",
    wompi_integrity_secret: "integrity_secret",
    wompi_events_secret: "events_secret",
  };
  const patch: Record<string, string> = {};
  for (const [columna, campo] of Object.entries(campos)) {
    const valor = String(formData.get(campo) ?? "").trim();
    if (valor) patch[columna] = valor;
  }
  if (Object.keys(patch).length === 0) {
    return { error: "Completá al menos un campo para guardar." };
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("negocios")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("id");
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!data?.length) return { error: "Negocio no encontrado o sin permisos." };

  invalidateBusinessCache();
  return { ok: "Credenciales de Wompi guardadas." };
}

// ── T-45: QR de cobro ────────────────────────────────────────────────────────

const BUCKET_QR = "pagos-qr";
const TIPOS_QR: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_QR_BYTES = 2 * 1024 * 1024; // mismo tope que el bucket (migración 0022)

/** Ruta dentro del bucket a partir de la URL pública, para borrar el QR anterior. */
function rutaQr(url: string | undefined): string | null {
  const marca = `/${BUCKET_QR}/`;
  const i = url?.indexOf(marca) ?? -1;
  return url && i >= 0 ? url.slice(i + marca.length) : null;
}

/**
 * Cambia `pagos.qrUrl` del negocio (o lo quita con `null`) pasando por Zod,
 * y borra la imagen anterior. Se lee y escribe con el cliente de la dueña:
 * si el negocio no es suyo, RLS no devuelve nada y no se toca el bucket.
 */
async function guardarQr(
  slug: string,
  subir: ((negocioId: string) => Promise<string | { error: string }>) | null,
): Promise<ActionState> {
  const supabase = await createUserClient();
  const { data: negocio } = await supabase.from("negocios").select("id, config").eq("slug", slug).maybeSingle();
  const actual = parseBusinessConfig(negocio?.config);
  if (!negocio || !actual) return { error: "Negocio no encontrado o sin permisos." };

  const admin = createAdminClient();
  if (!admin) return { error: "Falta configurar Supabase en el servidor." };

  let qrUrl: string | undefined;
  if (subir) {
    const subido = await subir(negocio.id as string);
    if (typeof subido !== "string") return subido;
    qrUrl = subido;
  }

  const config = parseBusinessConfig({ ...actual, pagos: { ...actual.pagos, qrUrl } });
  if (!config) return { error: "No se pudo validar la configuración." };
  const { error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", negocio.id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // Best-effort: si falla, queda un archivo huérfano en el bucket, nada más.
  const anterior = rutaQr(actual.pagos?.qrUrl);
  if (anterior) await admin.storage.from(BUCKET_QR).remove([anterior]);

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}/configuracion`);
  return { ok: qrUrl ? "QR guardado. El bot lo manda junto con tus cuentas." : "QR quitado." };
}

export async function subirQrPago(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };
  const slug = String(formData.get("slug") ?? "");
  const archivo = formData.get("qr");
  if (!slug) return { error: "Falta el negocio." };
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elegí la imagen del QR." };
  const ext = TIPOS_QR[archivo.type];
  if (!ext) return { error: "El QR tiene que ser una imagen PNG, JPG o WEBP." };
  if (archivo.size > MAX_QR_BYTES) return { error: "La imagen pesa más de 2 MB. Probá con una captura más chica." };

  return guardarQr(slug, async (negocioId) => {
    const admin = createAdminClient()!;
    // Nombre nuevo en cada subida: WhatsApp y los navegadores cachean por URL,
    // y con el mismo nombre el cliente podría recibir el QR viejo.
    const ruta = `${negocioId}/qr-${Date.now()}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET_QR)
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
    if (error) return { error: `No se pudo subir el QR: ${error.message}` };
    return admin.storage.from(BUCKET_QR).getPublicUrl(ruta).data.publicUrl;
  });
}

export async function quitarQrPago(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "No autorizado." };
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: "Falta el negocio." };
  return guardarQr(slug, null);
}
