/**
 * T-108: comentario → DM en el Instagram de Aurela (marketing).
 *
 * Quien comenta una palabra clave (ALMUERZO, CITA…) en un Reel o una
 * publicación de Aurela recibe un DM con un gancho y el enlace a la página.
 * Meta lo llama "respuesta privada": un mensaje directo dirigido al
 * comentario, no a la persona (no hace falta que ella nos haya escrito antes).
 *
 * Es la primera pieza del canal de Instagram: el webhook, la firma y el
 * cliente de la API de este módulo los reusa después el bot de los negocios.
 *
 * Funciones puras: el webhook (`app/api/webhook/instagram`) arma la
 * entrada y manda lo que esto decide.
 */

/** Un comentario nuevo, ya normalizado desde el webhook de Meta. */
export interface ComentarioInstagram {
  /** ID del comentario (a él va la respuesta privada). */
  id: string;
  /** Cuenta de Instagram que recibió el comentario (la de Aurela). */
  cuentaId: string;
  texto: string;
  /** Quién comentó. */
  autorId?: string;
  autorUsuario?: string;
  /** Si lo escribió la propia cuenta (Meta manda `self_ig_scoped_id`). */
  esPropio: boolean;
  /** Si es respuesta a otro comentario (no el comentario principal). */
  esRespuesta: boolean;
  mediaId?: string;
}

/** Una palabra clave y lo que se le contesta a quien la comenta. */
export interface RespuestaComentario {
  /** Palabras que disparan esta respuesta (se comparan sin tildes ni mayúsculas, como palabra completa). */
  palabras: string[];
  /** El DM. Puede llevar el enlace a la página en el texto. */
  mensaje: string;
  /** Respuesta pública opcional bajo el comentario ("¡Le escribí por DM! 📩"). */
  respuestaPublica?: string;
}

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

/**
 * Saca los comentarios del cuerpo del webhook. Acepta las dos formas que se
 * ven en la documentación y en integraciones reales de Instagram Login
 * (`entry[].changes[] = {field, value}` y `entry[] = {field, value}`), para
 * no depender de cuál manda Meta hoy. Lo que no sea un comentario se ignora.
 */
export function parseComentarios(payload: unknown): ComentarioInstagram[] {
  if (!esObj(payload) || payload.object !== "instagram" || !Array.isArray(payload.entry)) return [];
  const resultado: ComentarioInstagram[] = [];
  for (const entry of payload.entry) {
    if (!esObj(entry)) continue;
    const cuentaId = str(entry.id) ?? (typeof entry.id === "number" ? String(entry.id) : undefined);
    if (!cuentaId) continue;
    const cambios: unknown[] = Array.isArray(entry.changes) ? entry.changes : [entry];
    for (const cambio of cambios) {
      if (!esObj(cambio) || cambio.field !== "comments" || !esObj(cambio.value)) continue;
      const v = cambio.value;
      const id = str(v.id);
      const texto = typeof v.text === "string" ? v.text : "";
      if (!id) continue;
      const from = esObj(v.from) ? v.from : {};
      const media = esObj(v.media) ? v.media : {};
      const autorId = str(from.id);
      resultado.push({
        id,
        cuentaId,
        texto,
        autorId,
        autorUsuario: str(from.username),
        esPropio: from.self_ig_scoped_id !== undefined || autorId === cuentaId,
        esRespuesta: str(v.parent_id) !== undefined,
        mediaId: str(media.id),
      });
    }
  }
  return resultado;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Qué contestarle a un comentario, o `null` si no corresponde:
 * - comentarios de la propia cuenta (cuando Aurela responde en público, eso
 *   también llega como comentario y no debe contestarse a sí misma);
 * - respuestas dentro de un hilo (solo el comentario principal, para no
 *   escribirle dos veces a la misma conversación);
 * - comentarios sin ninguna palabra clave.
 * La palabra tiene que estar como palabra completa: "CITA" sí, "felicitaciones" no.
 */
export function decidirRespuesta(
  comentario: ComentarioInstagram,
  respuestas: RespuestaComentario[],
): RespuestaComentario | null {
  if (comentario.esPropio || comentario.esRespuesta) return null;
  const palabrasDelComentario = new Set(normalizar(comentario.texto).match(/[a-z0-9ñ]+/g) ?? []);
  return (
    respuestas.find((r) => r.palabras.some((p) => palabrasDelComentario.has(normalizar(p).trim()))) ?? null
  );
}

/**
 * Para no escribirle varias veces a la misma persona si comenta la palabra
 * en varios Reels seguidos: una vez cada `ventanaMs` por cuenta. En memoria
 * (un solo proceso en el VPS, mismo criterio que `limite-mensajes.ts`); un
 * reinicio la vacía y, como mucho, alguien recibe el DM otra vez.
 */
export class RecordadorDeAutores {
  private readonly ultimos = new Map<string, number>();

  constructor(private readonly ventanaMs = 24 * 3600_000) {}

  /** `true` si se le puede escribir ahora (y lo anota); `false` si ya se le escribió hace poco. */
  puedeEscribir(autor: string | undefined, ahora: Date): boolean {
    if (!autor) return true;
    const t = ahora.getTime();
    for (const [k, v] of this.ultimos) if (t - v >= this.ventanaMs) this.ultimos.delete(k);
    if (this.ultimos.has(autor)) return false;
    this.ultimos.set(autor, t);
    return true;
  }
}
