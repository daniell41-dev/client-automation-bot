import { describe, expect, it } from "vitest";
import { calcularSeñalesPago } from "@/core/engine/señales-pago";
import type { PaymentReceiptDescription } from "@/core/ai/payment-receipt-schema";

const ahora = new Date("2026-09-16T12:00:00.000Z");
const pedido = { total: 45000 };

function comprobante(overrides: Partial<PaymentReceiptDescription> = {}): PaymentReceiptDescription {
  return {
    banco: "nequi",
    referencia: "M12345678",
    monto: 45000,
    moneda: "COP",
    fechaISO: "2026-09-16T11:55:00.000Z", // 5 min antes, dentro de lo normal
    telefonoDestino: "3001112233",
    legible: "completo",
    ...overrides,
  };
}

describe("calcularSeñalesPago — caso limpio", () => {
  it("sin nada raro, no devuelve ninguna señal", () => {
    const señales = calcularSeñalesPago(
      comprobante(),
      pedido,
      { telefonoDestino: "3001112233", comprobantesPrevios: [] },
      "57300000000",
      ahora,
    );
    expect(señales).toEqual([]);
  });
});

describe("calcularSeñalesPago — referencia repetida", () => {
  it("la misma referencia usada antes en el negocio dispara señal alta", () => {
    const señales = calcularSeñalesPago(
      comprobante({ referencia: "M12345678" }),
      pedido,
      {
        comprobantesPrevios: [
          { referencia: "M12345678", contacto: "57399999999", creadoEn: "2026-09-10T10:00:00.000Z" },
        ],
      },
      "57300000000",
      ahora,
    );
    expect(señales).toContainEqual(
      expect.objectContaining({ tipo: "referencia_repetida", nivel: "alta" }),
    );
  });

  it("una referencia nueva no dispara nada", () => {
    const señales = calcularSeñalesPago(
      comprobante({ referencia: "NUEVA-1" }),
      pedido,
      { comprobantesPrevios: [{ referencia: "OTRA", contacto: "x", creadoEn: ahora.toISOString() }] },
      "57300000000",
      ahora,
    );
    expect(señales.some((s) => s.tipo === "referencia_repetida")).toBe(false);
  });
});

describe("calcularSeñalesPago — monto distinto", () => {
  it("el monto del comprobante no coincide con el total del pedido", () => {
    const señales = calcularSeñalesPago(
      comprobante({ monto: 30000 }),
      { total: 45000 },
      {},
      "57300000000",
      ahora,
    );
    expect(señales).toContainEqual(expect.objectContaining({ tipo: "monto_distinto", nivel: "media" }));
  });

  it("sin monto en el comprobante, no se puede comparar y no dispara nada", () => {
    const señales = calcularSeñalesPago(
      comprobante({ monto: undefined }),
      pedido,
      {},
      "57300000000",
      ahora,
    );
    expect(señales.some((s) => s.tipo === "monto_distinto")).toBe(false);
  });
});

describe("calcularSeñalesPago — destino no coincide", () => {
  it("el teléfono destino del comprobante no es el registrado del negocio", () => {
    const señales = calcularSeñalesPago(
      comprobante({ telefonoDestino: "3009998877" }),
      pedido,
      { telefonoDestino: "3001112233" },
      "57300000000",
      ahora,
    );
    expect(señales).toContainEqual(
      expect.objectContaining({ tipo: "destino_no_coincide", nivel: "alta" }),
    );
  });

  it("sin telefonoDestino registrado por el negocio, no se puede comparar", () => {
    const señales = calcularSeñalesPago(
      comprobante({ telefonoDestino: "3009998877" }),
      pedido,
      {},
      "57300000000",
      ahora,
    );
    expect(señales.some((s) => s.tipo === "destino_no_coincide")).toBe(false);
  });
});

describe("calcularSeñalesPago — fecha vieja", () => {
  it("un comprobante de hace más de 24h dispara señal media", () => {
    const señales = calcularSeñalesPago(
      comprobante({ fechaISO: "2026-09-14T10:00:00.000Z" }), // 2 días antes
      pedido,
      {},
      "57300000000",
      ahora,
    );
    expect(señales).toContainEqual(expect.objectContaining({ tipo: "fecha_vieja", nivel: "media" }));
  });
});

describe("calcularSeñalesPago — fecha futura", () => {
  it("un comprobante con fecha futura dispara señal alta", () => {
    const señales = calcularSeñalesPago(
      comprobante({ fechaISO: "2026-09-16T13:00:00.000Z" }), // 1h en el futuro
      pedido,
      {},
      "57300000000",
      ahora,
    );
    expect(señales).toContainEqual(expect.objectContaining({ tipo: "fecha_futura", nivel: "alta" }));
  });

  it("una diferencia de pocos minutos (reloj) no cuenta como futura", () => {
    const señales = calcularSeñalesPago(
      comprobante({ fechaISO: "2026-09-16T12:02:00.000Z" }), // 2 min en el futuro
      pedido,
      {},
      "57300000000",
      ahora,
    );
    expect(señales.some((s) => s.tipo === "fecha_futura")).toBe(false);
  });
});

describe("calcularSeñalesPago — ráfaga", () => {
  it("2+ comprobantes del mismo cliente en los últimos 10 minutos disparan ráfaga", () => {
    const señales = calcularSeñalesPago(
      comprobante(),
      pedido,
      {
        comprobantesPrevios: [
          { contacto: "57300000000", creadoEn: "2026-09-16T11:53:00.000Z" },
          { contacto: "57300000000", creadoEn: "2026-09-16T11:57:00.000Z" },
        ],
      },
      "57300000000",
      ahora,
    );
    expect(señales).toContainEqual(expect.objectContaining({ tipo: "rafaga", nivel: "media" }));
  });

  it("comprobantes de OTRO cliente no cuentan para la ráfaga", () => {
    const señales = calcularSeñalesPago(
      comprobante(),
      pedido,
      {
        comprobantesPrevios: [
          { contacto: "57399999999", creadoEn: "2026-09-16T11:58:00.000Z" },
          { contacto: "57399999999", creadoEn: "2026-09-16T11:59:00.000Z" },
        ],
      },
      "57300000000",
      ahora,
    );
    expect(señales.some((s) => s.tipo === "rafaga")).toBe(false);
  });

  it("comprobantes fuera de la ventana de 10 minutos no cuentan", () => {
    const señales = calcularSeñalesPago(
      comprobante(),
      pedido,
      {
        comprobantesPrevios: [
          { contacto: "57300000000", creadoEn: "2026-09-16T10:00:00.000Z" },
          { contacto: "57300000000", creadoEn: "2026-09-16T09:00:00.000Z" },
        ],
      },
      "57300000000",
      ahora,
    );
    expect(señales.some((s) => s.tipo === "rafaga")).toBe(false);
  });
});

describe("calcularSeñalesPago — nunca rechaza por sí sola", () => {
  it("puede devolver varias señales a la vez, todas informativas (nivel, nunca un booleano de rechazo)", () => {
    const señales = calcularSeñalesPago(
      comprobante({ monto: 1000, telefonoDestino: "0000000000", referencia: "DUP" }),
      pedido,
      {
        telefonoDestino: "3001112233",
        comprobantesPrevios: [{ referencia: "DUP", contacto: "x", creadoEn: "2026-01-01T00:00:00.000Z" }],
      },
      "57300000000",
      ahora,
    );
    expect(señales.length).toBeGreaterThan(1);
    for (const s of señales) {
      expect(["alta", "media", "baja"]).toContain(s.nivel);
    }
  });
});
