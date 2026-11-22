import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), after: vi.fn() }));

const { GET, POST, procesarComentarios } = await import("@/app/api/webhook/instagram/route");

const firmar = (cuerpo: string, secreto: string) =>
  "sha256=" + createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex");

const comentario = (id: string, texto: string, autor: string, extra: Record<string, unknown> = {}) => ({
  object: "instagram",
  entry: [{ id: "1784", changes: [{ field: "comments", value: { id, text: texto, from: { id: autor, username: "x" }, ...extra } }] }],
});

function dobles() {
  const cliente = { responderPrivado: vi.fn(async () => {}), responderPublico: vi.fn(async () => {}) };
  const vistos = new Set<string>();
  const dedupe = {
    claim: vi.fn(async (k: string) => {
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    }),
  };
  return { cliente, dedupe };
}

describe("GET /api/webhook/instagram (verificación de Meta)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("devuelve el challenge con el token correcto; 403 si no", async () => {
    vi.stubEnv("INSTAGRAM_VERIFY_TOKEN", "tok");
    const ok = await GET(new Request("https://x/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=123"));
    expect(await ok.text()).toBe("123");
    const mal = await GET(new Request("https://x/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=123"));
    expect(mal.status).toBe(403);
  });
});

describe("POST /api/webhook/instagram (firma)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const cuerpo = JSON.stringify(comentario("c-1", "ALMUERZO", "1"));

  it("sin App Secret configurado responde 503 (falla cerrado)", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "");
    expect((await POST(new Request("https://x", { method: "POST", body: cuerpo }))).status).toBe(503);
  });

  it("firma inválida → 401; firma correcta → 200", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "secreto");
    const mala = await POST(new Request("https://x", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": "sha256=00" } }));
    expect(mala.status).toBe(401);
    const buena = await POST(
      new Request("https://x", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": firmar(cuerpo, "secreto") } }),
    );
    expect(buena.status).toBe(200);
  });

  it("también acepta la firma con la clave general de la app (la de WhatsApp), y rechaza otra", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "secreto-instagram");
    vi.stubEnv("WHATSAPP_APP_SECRET", "secreto-app");
    const conLaDeLaApp = await POST(
      new Request("https://x", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": firmar(cuerpo, "secreto-app") } }),
    );
    expect(conLaDeLaApp.status).toBe(200);
    const conOtra = await POST(
      new Request("https://x", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": firmar(cuerpo, "de-un-atacante") } }),
    );
    expect(conOtra.status).toBe(401);
  });

  it("tolera espacios al final de la clave (pegada a mano en el servidor)", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "secreto  ");
    const r = await POST(new Request("https://x", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": firmar(cuerpo, "secreto") } }));
    expect(r.status).toBe(200);
  });
});

describe("procesarComentarios (T-108)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("palabra clave → DM al comentario y respuesta pública", async () => {
    const { cliente, dedupe } = dobles();
    await procesarComentarios(comentario("c-10", "ALMUERZO!", "a10"), { cliente, dedupe });
    expect(cliente.responderPrivado).toHaveBeenCalledWith("1784", "c-10", expect.stringContaining("soyaurela.com"));
    expect(cliente.responderPublico).toHaveBeenCalledWith("c-10", "¡Le escribí por DM! 📩");
  });

  it("sin palabra clave, o comentario propio: nada", async () => {
    const { cliente, dedupe } = dobles();
    await procesarComentarios(comentario("c-11", "qué lindo", "a11"), { cliente, dedupe });
    await procesarComentarios(comentario("c-12", "ALMUERZO", "a12", { from: { id: "a12", self_ig_scoped_id: "a12" } }), { cliente, dedupe });
    expect(cliente.responderPrivado).not.toHaveBeenCalled();
  });

  it("el mismo comentario reintentado por Meta se contesta una sola vez", async () => {
    const { cliente, dedupe } = dobles();
    const p = comentario("c-13", "CITA", "a13");
    await procesarComentarios(p, { cliente, dedupe });
    await procesarComentarios(p, { cliente, dedupe });
    expect(cliente.responderPrivado).toHaveBeenCalledTimes(1);
  });

  it("la misma persona en otro Reel el mismo día no recibe otro DM", async () => {
    const { cliente, dedupe } = dobles();
    await procesarComentarios(comentario("c-14", "CITA", "a14"), { cliente, dedupe });
    await procesarComentarios(comentario("c-15", "ALMUERZO", "a14"), { cliente, dedupe });
    expect(cliente.responderPrivado).toHaveBeenCalledTimes(1);
  });

  it("con INSTAGRAM_RESPUESTA_PUBLICA=false solo manda el DM", async () => {
    vi.stubEnv("INSTAGRAM_RESPUESTA_PUBLICA", "false");
    const { cliente, dedupe } = dobles();
    await procesarComentarios(comentario("c-16", "ALMUERZO", "a16"), { cliente, dedupe });
    expect(cliente.responderPrivado).toHaveBeenCalledTimes(1);
    expect(cliente.responderPublico).not.toHaveBeenCalled();
  });

  it("si falla el DM no revienta (corre después del ACK)", async () => {
    const { cliente, dedupe } = dobles();
    cliente.responderPrivado.mockRejectedValueOnce(new Error("Meta caído"));
    await expect(procesarComentarios(comentario("c-17", "ALMUERZO", "a17"), { cliente, dedupe })).resolves.toBeUndefined();
    expect(cliente.responderPublico).not.toHaveBeenCalled();
  });
});
