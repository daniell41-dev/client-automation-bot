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
import { errorLlaveWompi, type CampoWompi } from "@/core/payments/wompi-llaves";
import { motivoConfigInvalida, parseBusinessConfig, servicesSchema } from "@/core/config-schema";
import { combinarCatalogo, MAX_FILAS_IMPORTACION } from "@/core/catalogo/importar";
import { invalidateBusinessCache } from "@/businesses/business-cache";
import { cerrarCitaCumplida } from "@/core/engine/appointment-lifecycle";
import { fromRow, toRow } from "@/core/storage/adapters/supabase/leads";
import type { LeadRow } from "@/core/storage/adapters/supabase/api";
import { createInventoryRepository } from "@/core/storage/factory";
import type { Service } from "@/core/types";
import { formato, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.portal). */
const tt = textos.acciones.portal;

export interface ActionState {
  error?: string;
  ok?: string;
}

export async function actualizarConfig(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };

  const slug = String(formData.get("slug") ?? "");
  const configJson = String(formData.get("config") ?? "");
  if (!slug) return { error: tt.faltaElNegocio };

  let json: unknown;
  try {
    json = JSON.parse(configJson);
  } catch {
    return { error: tt.laConfiguracionNoEs };
  }
  const config = parseBusinessConfig(json);
  if (!config) return { error: tt.laConfiguracionNoCumple };

  // El slug del motor no se cambia desde el editor (identifica leads/sesiones).
  config.slug = slug;

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("id");
  if (error) return { error: formato(tt.noSePudoGuardar, { message: error.message }) };
  if (!data?.length) return { error: tt.negocioNoEncontradoO };

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}`);
  revalidatePath(`/portal/negocios/${slug}/editar`);
  return { ok: tt.configuracionGuardadaElAsistente };
}

/** Claves de la config que los editores del portal pueden modificar. */
const PATCH_KEYS = [
  "services",
  // T-110: los interruptores de referencia y detalles (Configuración).
  "catalogo",
  "horarios",
  "ai",
  "direccion",
  "personas",
  "messages",
  "pedidos",
  "notifyPhoneNumber",
  "pagos",
  "avisos",
  // T-111: lo manda la tarjeta "Seguimiento automático" (T-106). Sin esta
  // clave el portal decía "guardada" y el cambio se perdía en silencio.
  "seguimientos",
  // Resumen del día por WhatsApp a la dueña (tarjeta de Notificaciones).
  "resumenDiario",
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
  if (!me) return { error: tt.noAutorizado };

  const slug = String(formData.get("slug") ?? "");
  const patchJson = String(formData.get("patch") ?? "");
  if (!slug) return { error: tt.faltaElNegocio };

  let patch: Record<string, unknown>;
  try {
    patch = JSON.parse(patchJson) as Record<string, unknown>;
  } catch {
    return { error: tt.losCambiosNoSon };
  }

  const supabase = await createUserClient();
  const { data: negocio } = await supabase
    .from("negocios")
    .select("config")
    .eq("slug", slug)
    .maybeSingle();
  const actual = parseBusinessConfig(negocio?.config);
  if (!actual) return { error: tt.negocioNoEncontradoO2 };

  const merged: Record<string, unknown> = { ...actual };
  for (const key of PATCH_KEYS) {
    if (key in patch) merged[key] = patch[key];
  }

  const config = parseBusinessConfig(merged);
  if (!config) return { error: formato(tt.noSePudoGuardarMotivo, { motivo: motivoConfigInvalida(merged) ?? tt.cambiosNoCumplenForma }) };
  config.slug = slug; // el slug del motor nunca cambia desde los editores

  const { data, error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("id");
  if (error) return { error: formato(tt.noSePudoGuardar, { message: error.message }) };
  if (!data?.length) return { error: tt.negocioNoEncontradoO };

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
  return { ok: tt.guardadoElAsistenteYa };
}

/**
 * T-117: guarda una importación masiva de productos (pantalla "Importar
 * productos"). El navegador ya leyó el archivo y mandó los productos; aquí
 * NO se confía en eso: se validan otra vez con `servicesSchema`, se combinan
 * con el catálogo ACTUAL de la base (no con el que vio la dueña, que pudo
 * cambiar) y la config entera pasa por Zod antes de escribir (regla 5).
 * Antes de cambiar nada se guarda el catálogo anterior para poder deshacer.
 */
export async function importarProductos(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: tt.faltaElNegocio };

  let crudos: unknown;
  try {
    crudos = JSON.parse(String(formData.get("productos") ?? ""));
  } catch {
    return { error: tt.losProductosNoLlegaron };
  }
  const importados = servicesSchema.safeParse(crudos);
  if (!importados.success) return { error: tt.elArchivoNoTrae };
  if (importados.data.length > MAX_FILAS_IMPORTACION) {
    return { error: formato(tt.maximoMaxFilasImportacion, { MAX_FILAS_IMPORTACION }) };
  }

  const supabase = await createUserClient();
  const { data: negocio } = await supabase.from("negocios").select("config").eq("slug", slug).maybeSingle();
  const actual = parseBusinessConfig(negocio?.config);
  if (!actual) return { error: tt.negocioNoEncontradoO2 };

  const { catalogo, resumen } = combinarCatalogo(actual.services, importados.data);
  const config = parseBusinessConfig({
    ...actual,
    services: catalogo,
    respaldoCatalogo: { fecha: new Date().toISOString(), services: actual.services },
  });
  if (!config) return { error: tt.noSePudoImportar };
  config.slug = slug;

  const { data, error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("id");
  if (error) return { error: formato(tt.noSePudoImportar2, { message: error.message }) };
  if (!data?.length) return { error: tt.negocioNoEncontradoO };

  await sincronizarStock(data[0].id, config.services).catch((err) => {
    console.error("[inventario] no se pudo sincronizar el stock tras importar:", err);
  });
  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}`, "layout");
  return {
    ok: formato(tt.listoNuevosNuevosActualizados, { nuevos: resumen.nuevos, actualizados: resumen.actualizados, sinCambios: resumen.sinCambios }),
  };
}

/** T-117: vuelve el catálogo a como estaba antes de la última importación. */
export async function deshacerImportacion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createUserClient();
  const { data: negocio } = await supabase.from("negocios").select("config").eq("slug", slug).maybeSingle();
  const actual = parseBusinessConfig(negocio?.config);
  if (!actual) return { error: tt.negocioNoEncontradoO2 };
  if (!actual.respaldoCatalogo) return { error: tt.noHayNingunaImportacion };

  const config = parseBusinessConfig({ ...actual, services: actual.respaldoCatalogo.services, respaldoCatalogo: undefined });
  if (!config) return { error: tt.noSePudoDeshacer };
  config.slug = slug;
  delete config.respaldoCatalogo;

  const { data, error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("id");
  if (error) return { error: formato(tt.noSePudoDeshacer2, { message: error.message }) };
  if (!data?.length) return { error: tt.negocioNoEncontradoO };

  await sincronizarStock(data[0].id, config.services).catch((err) => {
    console.error("[inventario] no se pudo sincronizar el stock al deshacer:", err);
  });
  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}`, "layout");
  return { ok: tt.listoElCatalogoVolvio };
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
  if (!me) return { error: tt.noAutorizado };

  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return { error: tt.faltaLaCita };

  const supabase = await createUserClient();
  const { data: row } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (!row) return { error: tt.citaNoEncontradaO };

  const lead = fromRow(row as LeadRow);
  if (lead.stage !== "datos_completos") {
    return { error: tt.estaCitaNoEsta };
  }

  let cerrado;
  try {
    cerrado = cerrarCitaCumplida(lead, new Date());
  } catch (err) {
    return { error: formato(tt.noSePudoCerrar, { valor1: err instanceof Error ? err.message : String(err) }) };
  }

  const { data, error } = await supabase
    .from("leads")
    .update(toRow(cerrado, (row as LeadRow).negocio_id ?? undefined))
    .eq("id", leadId)
    .select("id");
  if (error) return { error: formato(tt.noSePudoCerrar2, { message: error.message }) };
  if (!data?.length) return { error: tt.citaNoEncontradaO };

  revalidatePath(`/portal/negocios/${lead.businessSlug}/citas`);
  return { ok: tt.citaMarcadaComoAtendida };
}

export async function actualizarWhatsapp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };

  const slug = String(formData.get("slug") ?? "");
  const phoneNumberId = String(formData.get("whatsapp_phone_number_id") ?? "").trim();
  if (!slug) return { error: tt.faltaElNegocio };

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
        ? tt.esePhoneNumberId
        : formato(tt.noSePudoGuardar, { message: error.message }),
    };
  }
  if (!data?.length) return { error: tt.negocioNoEncontradoO };

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}/editar`);
  return { ok: tt.conexionDeWhatsappActualizada };
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
  if (!me) return { error: tt.noAutorizado };

  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: tt.faltaElNegocio };

  const campos: Record<string, string> = {
    wompi_public_key: "public_key",
    wompi_integrity_secret: "integrity_secret",
    wompi_events_secret: "events_secret",
  };
  const patch: Record<string, string> = {};
  for (const [columna, campo] of Object.entries(campos)) {
    const valor = String(formData.get(campo) ?? "").trim();
    if (!valor) continue;
    const error = errorLlaveWompi(campo as CampoWompi, valor);
    if (error) return { error };
    patch[columna] = valor;
  }
  if (Object.keys(patch).length === 0) {
    return { error: tt.completeAlMenosUn };
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("negocios")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("id");
  if (error) return { error: formato(tt.noSePudoGuardar, { message: error.message }) };
  if (!data?.length) return { error: tt.negocioNoEncontradoO };

  invalidateBusinessCache();
  return { ok: tt.credencialesDeWompiGuardadas };
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
  if (!negocio || !actual) return { error: tt.negocioNoEncontradoO };

  const admin = createAdminClient();
  if (!admin) return { error: tt.faltaConfigurarSupabaseEn };

  let qrUrl: string | undefined;
  if (subir) {
    const subido = await subir(negocio.id as string);
    if (typeof subido !== "string") return subido;
    qrUrl = subido;
  }

  const config = parseBusinessConfig({ ...actual, pagos: { ...actual.pagos, qrUrl } });
  if (!config) return { error: tt.noSePudoValidar };
  const { error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", negocio.id);
  if (error) return { error: formato(tt.noSePudoGuardar, { message: error.message }) };

  // Best-effort: si falla, queda un archivo huérfano en el bucket, nada más.
  const anterior = rutaQr(actual.pagos?.qrUrl);
  if (anterior) await admin.storage.from(BUCKET_QR).remove([anterior]);

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}/configuracion`);
  return { ok: qrUrl ? tt.qrGuardadoElAsistente : tt.qrQuitado };
}

export async function subirQrPago(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };
  const slug = String(formData.get("slug") ?? "");
  const archivo = formData.get("qr");
  if (!slug) return { error: tt.faltaElNegocio };
  if (!(archivo instanceof File) || archivo.size === 0) return { error: tt.elijaLaImagenDel };
  const ext = TIPOS_QR[archivo.type];
  if (!ext) return { error: tt.elQrTieneQue };
  if (archivo.size > MAX_QR_BYTES) return { error: tt.laImagenPesaMas };

  return guardarQr(slug, async (negocioId) => {
    const admin = createAdminClient()!;
    // Nombre nuevo en cada subida: WhatsApp y los navegadores cachean por URL,
    // y con el mismo nombre el cliente podría recibir el QR viejo.
    const ruta = `${negocioId}/qr-${Date.now()}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET_QR)
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
    if (error) return { error: formato(tt.noSePudoSubir, { message: error.message }) };
    return admin.storage.from(BUCKET_QR).getPublicUrl(ruta).data.publicUrl;
  });
}

export async function quitarQrPago(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: tt.faltaElNegocio };
  return guardarQr(slug, null);
}

// ── T-121: catálogo en PDF ───────────────────────────────────────────────────

const BUCKET_CATALOGOS = "catalogos";
const MAX_CATALOGO_BYTES = 10 * 1024 * 1024; // mismo tope que el bucket (migración 0031)

/** Ruta dentro del bucket a partir de la URL pública, para borrar el PDF anterior. */
function rutaCatalogo(url: string | undefined): string | null {
  const marca = `/${BUCKET_CATALOGOS}/`;
  const i = url?.indexOf(marca) ?? -1;
  return url && i >= 0 ? url.slice(i + marca.length) : null;
}

/**
 * El navegador manda el `type` según la extensión: un .exe renombrado a .pdf
 * pasaría. Mirar los primeros bytes ("%PDF-") es barato y evita que el bucket
 * público sirva otra cosa con el nombre del negocio encima.
 */
async function esPdf(archivo: File): Promise<boolean> {
  const cabecera = new Uint8Array(await archivo.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...cabecera) === "%PDF-";
}

/**
 * Sube (o reemplaza) el PDF y guarda nombre e interruptor. Sin archivo nuevo
 * solo cambia el nombre o el interruptor del que ya estaba. Mismo esquema que
 * el QR: lee y escribe con el cliente de la dueña (RLS), sube con service
 * role y todo el config pasa por Zod antes de tocar la base.
 */
export async function guardarCatalogoPdf(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: tt.faltaElNegocio };
  const enviarAlSaludar = formData.get("enviarAlSaludar") === "on";
  const archivo = formData.get("catalogo");
  const hayArchivo = archivo instanceof File && archivo.size > 0;
  if (hayArchivo) {
    if (archivo.type !== "application/pdf" || !(await esPdf(archivo))) {
      return { error: tt.elCatalogoTieneQue };
    }
    if (archivo.size > MAX_CATALOGO_BYTES) {
      return { error: tt.elPdfPesaMas };
    }
  }

  const supabase = await createUserClient();
  const { data: negocio } = await supabase.from("negocios").select("id, config").eq("slug", slug).maybeSingle();
  const actual = parseBusinessConfig(negocio?.config);
  if (!negocio || !actual) return { error: tt.negocioNoEncontradoO };
  if (!hayArchivo && !actual.catalogoPdf) return { error: tt.elijaElPdfDel };

  // El nombre lo ve el cliente en el chat: si la dueña no escribió uno, se
  // usa el del archivo que subió (o el que ya tenía).
  const nombreArchivo =
    String(formData.get("nombreArchivo") ?? "").trim() ||
    (hayArchivo ? archivo.name : actual.catalogoPdf?.nombreArchivo) ||
    tt.catalogoPdf;

  const admin = createAdminClient();
  if (!admin) return { error: tt.faltaConfigurarSupabaseEn };

  let url = actual.catalogoPdf?.url;
  if (hayArchivo) {
    // Nombre nuevo en cada subida: WhatsApp cachea por URL, y con el mismo
    // nombre el cliente podría recibir el catálogo viejo.
    const ruta = `${negocio.id as string}/catalogo-${Date.now()}.pdf`;
    const { error } = await admin.storage
      .from(BUCKET_CATALOGOS)
      .upload(ruta, archivo, { contentType: "application/pdf", upsert: false });
    if (error) return { error: formato(tt.noSePudoSubir2, { message: error.message }) };
    url = admin.storage.from(BUCKET_CATALOGOS).getPublicUrl(ruta).data.publicUrl;
  }

  const config = parseBusinessConfig({ ...actual, catalogoPdf: { url, nombreArchivo, enviarAlSaludar } });
  if (!config) return { error: tt.noSePudoValidar2 };
  const { error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", negocio.id);
  if (error) return { error: formato(tt.noSePudoGuardar, { message: error.message }) };

  // Best-effort: si falla, queda un archivo huérfano en el bucket, nada más.
  const anterior = hayArchivo ? rutaCatalogo(actual.catalogoPdf?.url) : null;
  if (anterior) await admin.storage.from(BUCKET_CATALOGOS).remove([anterior]);

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}/configuracion`);
  return { ok: hayArchivo ? tt.catalogoGuardado : tt.cambiosDelCatalogoGuardados };
}

export async function quitarCatalogoPdf(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: tt.faltaElNegocio };

  const supabase = await createUserClient();
  const { data: negocio } = await supabase.from("negocios").select("id, config").eq("slug", slug).maybeSingle();
  const actual = parseBusinessConfig(negocio?.config);
  if (!negocio || !actual) return { error: tt.negocioNoEncontradoO };

  const config = parseBusinessConfig({ ...actual, catalogoPdf: undefined });
  if (!config) return { error: tt.noSePudoValidar };
  const { error } = await supabase
    .from("negocios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", negocio.id);
  if (error) return { error: formato(tt.noSePudoGuardar, { message: error.message }) };

  const anterior = rutaCatalogo(actual.catalogoPdf?.url);
  const admin = createAdminClient();
  if (anterior && admin) await admin.storage.from(BUCKET_CATALOGOS).remove([anterior]);

  invalidateBusinessCache();
  revalidatePath(`/portal/negocios/${slug}/configuracion`);
  return { ok: tt.catalogoQuitadoElAsistente };
}
