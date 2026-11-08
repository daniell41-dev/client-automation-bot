import { describe, expect, it } from "vitest";
import { cerrarPedidoFinalizado, pedidoFinalizado } from "@/core/engine/pedido-lifecycle";
import type { Lead } from "@/core/types";

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "1",
    businessSlug: "tienda",
    channel: "mock",
    contact: "573000",
    name: "Laura",
    serviceId: "harina",
    items: [{ serviceId: "harina", cantidad: 2 }],
    state: "pagado",
    stage: "datos_completos",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    lastInboundAt: "2026-06-01T00:00:00.000Z",
    followUpsSent: [],
    ...overrides,
  };
}

describe("pedidoFinalizado", () => {
  it("un pedido pagado en datos_completos está finalizado", () => {
    expect(pedidoFinalizado(baseLead())).toBe(true);
  });

  it("no depende de `now` — es inmediato, no un plazo", () => {
    // Sin timestamp de comparación: si es true ahora, sigue siendo true en cualquier momento.
    expect(pedidoFinalizado(baseLead())).toBe(true);
  });

  it("una cita agendada (sin items) NUNCA se da por finalizada acá", () => {
    const cita = baseLead({ items: undefined, serviceId: "limpieza-facial", state: "agendado" });
    expect(pedidoFinalizado(cita)).toBe(false);
  });

  it("un pedido que todavía no llegó a datos_completos no está finalizado", () => {
    expect(pedidoFinalizado(baseLead({ stage: "esperando_aprobacion", state: "interesado" }))).toBe(false);
  });

  it("un pedido en datos_completos pero sin pasar por 'pagado' no se toca (defensivo)", () => {
    expect(pedidoFinalizado(baseLead({ state: "interesado" }))).toBe(false);
  });
});

describe("cerrarPedidoFinalizado", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  it("pasa a 'recurrente' y stage 'inicio'", () => {
    const cerrado = cerrarPedidoFinalizado(baseLead(), now);
    expect(cerrado.state).toBe("recurrente");
    expect(cerrado.stage).toBe("inicio");
  });

  it("conserva identidad y nombre; limpia lo del pedido", () => {
    const cerrado = cerrarPedidoFinalizado(baseLead(), now);
    expect(cerrado.id).toBe("1");
    expect(cerrado.contact).toBe("573000");
    expect(cerrado.name).toBe("Laura");
    expect(cerrado.serviceId).toBeUndefined();
    expect(cerrado.items).toBeUndefined();
    expect(cerrado.confirmedAt).toBeUndefined();
    expect(cerrado.updatedAt).toBe(now.toISOString());
  });
});
