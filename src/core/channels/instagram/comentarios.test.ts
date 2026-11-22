import { describe, expect, it, vi } from "vitest";
import { decidirRespuesta, parseComentarios, RecordadorDeAutores } from "@/core/channels/instagram/comentarios";
import { InstagramClient } from "@/core/channels/instagram/send";

const respuestas = [
  { palabras: ["ALMUERZO"], mensaje: "Hola, soy Aurela 👋 soyaurela.com", respuestaPublica: "¡Le escribí por DM! 📩" },
  { palabras: ["CITA"], mensaje: "Hola, soy Aurela 💅 soyaurela.com" },
];

const comentarioDe = (texto: string, extra: Record<string, unknown> = {}) => ({
  object: "instagram",
  entry: [
    {
      id: "17841400000000000",
      time: 1764000000,
      changes: [
        {
          field: "comments",
          value: { id: "c-1", text: texto, from: { id: "999", username: "dona_rosa" }, media: { id: "m-1" }, ...extra },
        },
      ],
    },
  ],
});

describe("T-108: leer el webhook de comentarios", () => {
  it("forma con changes[]", () => {
    expect(parseComentarios(comentarioDe("ALMUERZO"))).toEqual([
      {
        id: "c-1",
        cuentaId: "17841400000000000",
        texto: "ALMUERZO",
        autorId: "999",
        autorUsuario: "dona_rosa",
        esPropio: false,
        esRespuesta: false,
        mediaId: "m-1",
      },
    ]);
  });

  it("forma sin changes[] (field y value directo en la entrada)", () => {
    const payload = { object: "instagram", entry: [{ id: "1784", field: "comments", value: { id: "c-2", text: "cita" } }] };
    expect(parseComentarios(payload)[0]).toMatchObject({ id: "c-2", cuentaId: "1784", texto: "cita" });
  });

  it("marca los comentarios propios y las respuestas en hilo", () => {
    expect(parseComentarios(comentarioDe("x", { from: { id: "5", self_ig_scoped_id: "5" } }))[0].esPropio).toBe(true);
    expect(parseComentarios(comentarioDe("x", { parent_id: "c-0" }))[0].esRespuesta).toBe(true);
  });

  it("ignora lo que no es un comentario o viene mal formado", () => {
    expect(parseComentarios({ object: "page", entry: [] })).toEqual([]);
    expect(parseComentarios({ object: "instagram", entry: [{ id: "1", changes: [{ field: "mentions", value: {} }] }] })).toEqual([]);
    expect(parseComentarios(null)).toEqual([]);
  });
});

describe("T-108: a qué comentario se le responde", () => {
  const c = (texto: string, extra = {}) => ({ ...parseComentarios(comentarioDe(texto))[0], ...extra });

  it("la palabra clave en cualquier parte, sin importar mayúsculas ni tildes", () => {
    expect(decidirRespuesta(c("ALMUERZO"), respuestas)?.mensaje).toContain("👋");
    expect(decidirRespuesta(c("quiero ver! almuerzo 🙌"), respuestas)?.mensaje).toContain("👋");
    expect(decidirRespuesta(c("Cita por favor"), respuestas)?.mensaje).toContain("💅");
  });

  it("como palabra completa: 'felicitaciones' no es CITA", () => {
    expect(decidirRespuesta(c("felicitaciones!"), respuestas)).toBeNull();
    expect(decidirRespuesta(c("qué bonito"), respuestas)).toBeNull();
  });

  it("nunca a sí misma ni dentro de un hilo", () => {
    expect(decidirRespuesta(c("ALMUERZO", { esPropio: true }), respuestas)).toBeNull();
    expect(decidirRespuesta(c("ALMUERZO", { esRespuesta: true }), respuestas)).toBeNull();
  });
});

describe("T-108: una vez por persona", () => {
  it("no le escribe dos veces a la misma cuenta en 24 h", () => {
    const r = new RecordadorDeAutores();
    const t = new Date("2026-11-23T12:00:00Z");
    expect(r.puedeEscribir("999", t)).toBe(true);
    expect(r.puedeEscribir("999", new Date(t.getTime() + 3600_000))).toBe(false);
    expect(r.puedeEscribir("888", t)).toBe(true);
    expect(r.puedeEscribir("999", new Date(t.getTime() + 25 * 3600_000))).toBe(true);
  });
});

describe("T-108: cliente de la API de Instagram", () => {
  it("respuesta privada: POST /{cuenta}/messages con comment_id y el token en la cabecera", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"message_id":"m1"}', { status: 200 }));
    await new InstagramClient({ accessToken: "TOKEN", fetchImpl }).responderPrivado("1784", "c-1", "Hola");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.instagram.com/v23.0/1784/messages");
    expect(url).not.toContain("TOKEN");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN");
    expect(JSON.parse(String(init.body))).toEqual({ recipient: { comment_id: "c-1" }, message: { text: "Hola" } });
  });

  it("respuesta pública: POST /{comentario}/replies", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await new InstagramClient({ accessToken: "T", fetchImpl, apiVersion: "v24.0" }).responderPublico("c-1", "¡Le escribí!");
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://graph.instagram.com/v24.0/c-1/replies");
  });

  it("si Meta responde error, lanza con el detalle (para el registro)", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"message":"bad"}}', { status: 400 }));
    await expect(new InstagramClient({ accessToken: "T", fetchImpl }).responderPrivado("1", "c", "x")).rejects.toThrow(/400/);
  });
});
