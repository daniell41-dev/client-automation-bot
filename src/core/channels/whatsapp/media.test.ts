import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadWhatsAppMedia } from "@/core/channels/whatsapp/media";

const opts = { accessToken: "TOKEN" };

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("downloadWhatsAppMedia — éxito", () => {
  it("pide la URL temporal y descarga el archivo en base64", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ url: "https://lookaside.fbsbx.com/x", mime_type: "image/jpeg" }),
      )
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => bytes.buffer,
      } as Response);

    const result = await downloadWhatsAppMedia("media-1", { ...opts, fetchImpl });

    expect(result).toEqual({ base64: Buffer.from(bytes).toString("base64"), mimeType: "image/jpeg" });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://graph.facebook.com/v21.0/media-1", {
      headers: { Authorization: "Bearer TOKEN" },
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://lookaside.fbsbx.com/x", {
      headers: { Authorization: "Bearer TOKEN" },
    });
  });

  it("respeta una apiVersion personalizada al pedir los metadatos", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ url: "https://x", mime_type: "image/png" }))
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) } as Response);

    await downloadWhatsAppMedia("media-1", { ...opts, fetchImpl, apiVersion: "v22.0" });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://graph.facebook.com/v22.0/media-1", expect.anything());
  });
});

describe("downloadWhatsAppMedia — fallos controlados (nunca lanza)", () => {
  it("404 al pedir los metadatos: devuelve null", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({}, false));
    await expect(downloadWhatsAppMedia("media-1", { ...opts, fetchImpl })).resolves.toBeNull();
  });

  it("404 al descargar el archivo: devuelve null", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ url: "https://x", mime_type: "image/jpeg" }))
      .mockResolvedValueOnce({ ok: false } as Response);
    await expect(downloadWhatsAppMedia("media-1", { ...opts, fetchImpl })).resolves.toBeNull();
  });

  it("mime type no soportado (p. ej. PDF): devuelve null sin descargar el archivo", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ url: "https://x", mime_type: "application/pdf" }));
    await expect(downloadWhatsAppMedia("media-1", { ...opts, fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("archivo sobredimensionado (> 4MB en base64): devuelve null", async () => {
    const grande = new ArrayBuffer(3.5 * 1024 * 1024); // ~4.67MB en base64
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ url: "https://x", mime_type: "image/webp" }))
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => grande } as Response);
    await expect(downloadWhatsAppMedia("media-1", { ...opts, fetchImpl })).resolves.toBeNull();
  });

  it("timeout: corta y devuelve null sin colgarse", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockReturnValue(new Promise(() => {})); // nunca resuelve
    const promise = downloadWhatsAppMedia("media-1", { ...opts, fetchImpl, timeoutMs: 10_000 });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toBeNull();
  });

  it("un error de red (fetch rechaza) devuelve null, no lanza", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("network down"));
    await expect(downloadWhatsAppMedia("media-1", { ...opts, fetchImpl })).resolves.toBeNull();
  });

  it("no reintenta: un solo llamado por endpoint aunque falle", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("boom"));
    await downloadWhatsAppMedia("media-1", { ...opts, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
