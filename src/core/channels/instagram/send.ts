/**
 * T-108: cliente mínimo de la API de Instagram (Instagram API with Instagram
 * Login, host graph.instagram.com) para responder comentarios.
 *
 * - Respuesta privada: POST /{cuenta}/messages con `recipient.comment_id`.
 *   Meta permite UNA por comentario y dentro de los 7 días siguientes.
 * - Respuesta pública: POST /{comentario}/replies con `message`.
 *
 * El token va en la cabecera `Authorization`, no en la URL: así no queda
 * escrito en los registros del servidor ni de un proxy.
 */

export interface InstagramClientOptions {
  accessToken: string;
  /** Versión de la API. Configurable porque Meta las retira cada ~2 años. */
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}

export const INSTAGRAM_API_VERSION_DEFAULT = "v23.0";

export class InstagramClient {
  constructor(private readonly opts: InstagramClientOptions) {}

  private url(ruta: string): string {
    return `https://graph.instagram.com/${this.opts.apiVersion ?? INSTAGRAM_API_VERSION_DEFAULT}/${ruta}`;
  }

  private async post(ruta: string, cuerpo: unknown): Promise<unknown> {
    const res = await (this.opts.fetchImpl ?? fetch)(this.url(ruta), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const texto = await res.text();
    if (!res.ok) throw new Error(`Instagram ${ruta} falló: ${res.status} ${texto.slice(0, 300)}`);
    try {
      return JSON.parse(texto);
    } catch {
      return texto;
    }
  }

  /** DM a quien escribió el comentario. */
  async responderPrivado(cuentaId: string, comentarioId: string, texto: string): Promise<void> {
    await this.post(`${encodeURIComponent(cuentaId)}/messages`, {
      recipient: { comment_id: comentarioId },
      message: { text: texto },
    });
  }

  /** Respuesta visible debajo del comentario. */
  async responderPublico(comentarioId: string, texto: string): Promise<void> {
    await this.post(`${encodeURIComponent(comentarioId)}/replies`, { message: texto });
  }
}
