import { describe, expect, it, vi } from "vitest";
import {
  aplanarParametro,
  buildSendRequest,
  buildTemplateRequest,
  esVentanaCerrada,
  WhatsAppChannel,
} from "@/core/channels/whatsapp/send";

const opts = {
  phoneNumberId: "111111111111111",
  accessToken: "TOKEN",
};

const plantilla = { nombre: "aviso_pedido_aprobacion", idioma: "es" };

/** Cuerpo de error tal como lo devuelve Meta cuando la ventana de 24h expiró. */
function errorVentanaCerrada(): string {
  return JSON.stringify({
    error: {
      message: "(#131047) Re-engagement message",
      code: 131047,
      error_data: { details: "Message failed to send because more than 24 hours..." },
    },
  });
}

describe("buildSendRequest", () => {
  it("construye URL, headers y body correctos", () => {
    const { url, init } = buildSendRequest(opts, {
      to: "573009998877",
      text: "Hola 💜",
    });
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/111111111111111/messages",
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TOKEN");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe("573009998877");
    expect(body.type).toBe("text");
    expect(body.text.body).toBe("Hola 💜");
  });

  it("respeta una apiVersion personalizada", () => {
    const { url } = buildSendRequest({ ...opts, apiVersion: "v22.0" }, {
      to: "x",
      text: "y",
    });
    expect(url).toContain("/v22.0/");
  });
});

describe("WhatsAppChannel.send", () => {
  it("llama a fetch con la request construida", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true } as Response);
    const channel = new WhatsAppChannel({ ...opts, fetchImpl });
    await channel.send({ to: "573009998877", text: "Hola" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(channel.channel).toBe("whatsapp");
  });

  it("lanza si la respuesta no es ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad request",
    } as Response);
    const channel = new WhatsAppChannel({ ...opts, fetchImpl });
    await expect(channel.send({ to: "x", text: "y" })).rejects.toThrow(/400/);
  });
});

/**
 * T-25: el aviso a la dueña lo inicia el bot, así que fuera de la ventana de
 * 24h Meta solo acepta plantillas aprobadas. El canal reintenta solo ante ese
 * error concreto — ver el comentario de `CODIGOS_VENTANA_CERRADA`.
 */
describe("esVentanaCerrada", () => {
  it("reconoce el 131047 de Meta", () => {
    expect(esVentanaCerrada(errorVentanaCerrada())).toBe(true);
  });

  it("reconoce el 470 de la API vieja", () => {
    expect(esVentanaCerrada(JSON.stringify({ error: { code: 470 } }))).toBe(true);
  });

  it("un 131026 genérico (número inválido/sin WhatsApp) NO es ventana cerrada", () => {
    expect(esVentanaCerrada(JSON.stringify({ error: { code: 131026 } }))).toBe(false);
  });

  it("un cuerpo que no es JSON no se toma como ventana cerrada", () => {
    expect(esVentanaCerrada("<html>502 Bad Gateway</html>")).toBe(false);
  });
});

describe("aplanarParametro", () => {
  it("colapsa los saltos de línea en un separador (Meta los rechaza)", () => {
    expect(aplanarParametro("Harina x2\nAceite x1\nTotal: $45.000")).toBe(
      "Harina x2 · Aceite x1 · Total: $45.000",
    );
  });

  it("colapsa espacios seguidos y recorta las puntas", () => {
    expect(aplanarParametro("  Pedido    grande  ")).toBe("Pedido grande");
  });
});

describe("buildTemplateRequest", () => {
  it("arma el body de plantilla con nombre, idioma y parámetros", () => {
    const { url, init } = buildTemplateRequest(
      { ...opts, plantilla },
      "573009998877",
      ["Estética Bella", "Laura", "Harina x2\nTotal: $45.000"],
    );
    expect(url).toBe("https://graph.facebook.com/v21.0/111111111111111/messages");
    const body = JSON.parse(init.body as string);
    expect(body.type).toBe("template");
    expect(body.to).toBe("573009998877");
    expect(body.template.name).toBe("aviso_pedido_aprobacion");
    expect(body.template.language.code).toBe("es");
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "Estética Bella" },
      { type: "text", text: "Laura" },
      // aplanado: la plantilla no admite saltos de línea en las variables
      { type: "text", text: "Harina x2 · Total: $45.000" },
    ]);
  });
});

describe("WhatsAppChannel.send — respaldo con plantilla (T-25)", () => {
  const mensajeConPlantilla = {
    to: "573009998877",
    text: "🔔 Pedido nuevo\nCliente: Laura",
    plantillaParams: ["Estética Bella", "Laura", "Harina x2"],
  };

  it("ventana cerrada + plantilla configurada: reintenta y entrega la plantilla", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => errorVentanaCerrada(),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    const channel = new WhatsAppChannel({ ...opts, fetchImpl, plantilla });
    await expect(channel.send(mensajeConPlantilla)).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const segundoBody = JSON.parse(fetchImpl.mock.calls[1][1].body as string);
    expect(segundoBody.type).toBe("template");
  });

  it("ventana abierta: manda texto libre y nunca toca la plantilla", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true } as Response);
    const channel = new WhatsAppChannel({ ...opts, fetchImpl, plantilla });

    await channel.send(mensajeConPlantilla);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.type).toBe("text");
  });

  it("sin plantilla configurada: el error de ventana cerrada se propaga igual que antes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => errorVentanaCerrada(),
    } as Response);
    const channel = new WhatsAppChannel({ ...opts, fetchImpl });

    await expect(channel.send(mensajeConPlantilla)).rejects.toThrow(/131047/);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("un error que no es de ventana no gasta una plantilla", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { code: 131026 } }),
    } as Response);
    const channel = new WhatsAppChannel({ ...opts, fetchImpl, plantilla });

    await expect(channel.send(mensajeConPlantilla)).rejects.toThrow(/131026/);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("mensaje sin plantillaParams (respuesta a cliente): no reintenta", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => errorVentanaCerrada(),
    } as Response);
    const channel = new WhatsAppChannel({ ...opts, fetchImpl, plantilla });

    await expect(channel.send({ to: "x", text: "y" })).rejects.toThrow(/131047/);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("si la plantilla también falla, el error nombra los dos intentos", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => errorVentanaCerrada(),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { code: 132001, message: "template not found" } }),
      } as Response);

    const channel = new WhatsAppChannel({ ...opts, fetchImpl, plantilla });
    await expect(channel.send(mensajeConPlantilla)).rejects.toThrow(/texto y plantilla/);
  });
});
