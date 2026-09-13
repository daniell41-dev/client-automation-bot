import { describe, expect, it } from "vitest";
import {
  INACTIVIDAD_MS,
  inactivo,
  limpiarDatosCapturados,
  reseteablePorInactividad,
} from "@/core/engine/session-lifecycle";
import type { Lead } from "@/core/types";

describe("inactivo", () => {
  const lastInboundAt = "2026-06-01T00:00:00.000Z";

  it("a las 23h59 desde el último mensaje, todavía activo", () => {
    const now = new Date("2026-06-01T23:59:00.000Z");
    expect(inactivo(lastInboundAt, now)).toBe(false);
  });

  it("a las 24h01 desde el último mensaje, inactivo", () => {
    const now = new Date("2026-06-02T00:01:00.000Z");
    expect(inactivo(lastInboundAt, now)).toBe(true);
  });

  it("acepta un ttl custom", () => {
    const now = new Date("2026-06-01T00:30:00.000Z");
    expect(inactivo(lastInboundAt, now, 15 * 60 * 1000)).toBe(true);
  });

  it("INACTIVIDAD_MS son 24 horas", () => {
    expect(INACTIVIDAD_MS).toBe(24 * 60 * 60 * 1000);
  });
});

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "1",
    businessSlug: "estetica-bella",
    channel: "mock",
    contact: "57300000000",
    state: "interesado",
    stage: "esperando_fecha",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    lastInboundAt: "2026-06-01T00:00:00.000Z",
    followUpsSent: [],
    ...overrides,
  };
}

describe("reseteablePorInactividad", () => {
  it("un lead con la cita ya confirmada (datos_completos) nunca es reseteable", () => {
    expect(reseteablePorInactividad(baseLead({ stage: "datos_completos" }))).toBe(false);
  });

  it.each([
    "menu_enviado",
    "info_enviada",
    "esperando_nombre",
    "esperando_fecha",
    "esperando_confirmacion",
    "esperando_entrega",
  ] as const)("un lead en '%s' sí es reseteable", (stage) => {
    expect(reseteablePorInactividad(baseLead({ stage }))).toBe(true);
  });
});

describe("limpiarDatosCapturados", () => {
  it("borra lo capturado y conserva la identidad del lead", () => {
    const lead = baseLead({
      name: "Laura",
      serviceId: "limpieza-facial",
      tentativeDate: "el sábado",
      entrega: "Retirar en el local",
      notes: "nota vieja",
      offTopicCount: 2,
      state: "interesado",
    });

    limpiarDatosCapturados(lead);

    expect(lead.id).toBe("1");
    expect(lead.contact).toBe("57300000000");
    expect(lead.createdAt).toBe("2026-06-01T00:00:00.000Z");
    expect(lead.state).toBe("nuevo");
    expect(lead.stage).toBe("inicio");
    expect(lead.name).toBeUndefined();
    expect(lead.serviceId).toBeUndefined();
    expect(lead.tentativeDate).toBeUndefined();
    expect(lead.entrega).toBeUndefined();
    expect(lead.notes).toBeUndefined();
    expect(lead.offTopicCount).toBe(0);
  });
});
