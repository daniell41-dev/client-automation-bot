/**
 * Descarga de media entrante de WhatsApp Cloud API (T-23.2).
 *
 * Meta no da la imagen directamente en el webhook: solo un `media_id`. Hay que
 * pedir la URL temporal (`GET /{media_id}`) y después descargarla con el mismo
 * token. Nunca lanza: si algo falla (404, mime no soportado, timeout, archivo
 * sobredimensionado) devuelve `null` y quien llama cae a la plantilla de
 * respaldo — igual que un proveedor de IA caído en `resilient.ts`.
 *
 * Límites duros, no configurables: los pone la doc de los proveedores con
 * visión (Gemini/Groq), no una preferencia del negocio.
 */

/** Tipos de imagen que los proveedores con visión (T-23.3) aceptan. */
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** 4 MB en base64 — no en el archivo original, que pesa menos. */
const MAX_BASE64_BYTES = 4 * 1024 * 1024;

const DEFAULT_TIMEOUT_MS = 10_000;

export interface WhatsAppMediaOptions {
  accessToken: string;
  /** Versión de la Graph API (default v21.0). */
  apiVersion?: string;
  /** Inyectable para tests; por defecto el `fetch` global. */
  fetchImpl?: typeof fetch;
  /** Default 10s. Sin reintentos: si se corta, se cae a la plantilla. */
  timeoutMs?: number;
}

export interface DownloadedMedia {
  base64: string;
  mimeType: string;
}

interface MetaMediaMetadata {
  url?: string;
  mime_type?: string;
}

function conTimeout<T>(trabajo: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout tras ${ms}ms`)), ms);
    trabajo.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function descargar(
  mediaId: string,
  opts: WhatsAppMediaOptions,
): Promise<DownloadedMedia | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const version = opts.apiVersion ?? "v21.0";
  const headers = { Authorization: `Bearer ${opts.accessToken}` };

  const metaRes = await fetchImpl(`https://graph.facebook.com/${version}/${mediaId}`, {
    headers,
  });
  if (!metaRes.ok) return null;

  const meta = (await metaRes.json()) as MetaMediaMetadata;
  if (!meta.url || !meta.mime_type || !ALLOWED_MIME_TYPES.has(meta.mime_type)) {
    return null;
  }

  const fileRes = await fetchImpl(meta.url, { headers });
  if (!fileRes.ok) return null;

  const buffer = await fileRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  if (Buffer.byteLength(base64) > MAX_BASE64_BYTES) return null;

  return { base64, mimeType: meta.mime_type };
}

/**
 * Descarga la imagen de un `media_id` de WhatsApp. Nunca lanza: cualquier
 * fallo (red, 404, mime no soportado, timeout, archivo sobredimensionado)
 * devuelve `null`.
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
  opts: WhatsAppMediaOptions,
): Promise<DownloadedMedia | null> {
  try {
    return await conTimeout(descargar(mediaId, opts), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  } catch (err) {
    console.error(`[whatsapp/media] no se pudo descargar ${mediaId}, cae a la plantilla:`, err);
    return null;
  }
}
