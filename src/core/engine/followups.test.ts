import { describe, expect, it } from "vitest";
import { dueFollowUps, nextFollowUp } from "@/core/engine/followups";
import type { BusinessConfig, Lead } from "@/core/types";

const config: BusinessConfig = {
  slug: "test",
  name: "Estética Test",
  currency: "COP",
  services: [
    {
      id: "limpieza-facial",
      name: "Limpieza facial",
      description: "x",
      price: 120000,
      durationMinutes: 60,
    },
  ],
  messages: {
    welcome: "",
    askName: "",
    askDate: "",
    askConfirm: "",
    serviceInfo: "",
    captured: "",
    fallback: "",
  },
  followUps: [
    { threshold: "2h", afterMinutes: 120, message: "Hola {{nombre}}, ¿te comparto horarios de {{servicio}}?" },
    { threshold: "1d", afterMinutes: 1440, message: "Tenemos cupos para {{servicio}} esta semana." },
    { threshold: "3d", afterMinutes: 4320, message: "Último mensaje 😊 ¿Te aviso de promos de {{servicio}}?" },
  ],
};

function lead(overrides: Partial<Lead> = {}): Lead {
  const base: Lead = {
    id: "lead-1",
    businessSlug: "test",
    channel: "mock",
    contact: "57300000000",
    name: "Laura",
    serviceId: "limpieza-facial",
    state: "interesado",
    stage: "esperando_nombre",
    createdAt: "2026-06-21T10:00:00.000Z",
    updatedAt: "2026-06-21T10:00:00.000Z",
    lastInboundAt: "2026-06-21T10:00:00.000Z",
    followUpsSent: [],
  };
  return { ...base, ...overrides };
}

describe("nextFollowUp", () => {
  it("no hay seguimiento antes de 2h", () => {
    const now = new Date("2026-06-21T11:00:00.000Z"); // +1h
    expect(nextFollowUp(lead(), config, now)).toBeNull();
  });

  it("a las 2h propone el seguimiento '2h' con mensaje renderizado", () => {
    const now = new Date("2026-06-21T12:00:00.000Z"); // +2h
    const fu = nextFollowUp(lead(), config, now);
    expect(fu?.threshold).toBe("2h");
    expect(fu?.message).toContain("Laura");
    expect(fu?.message).toContain("Limpieza facial");
  });

  it("no repite un seguimiento ya enviado; pasa al siguiente vencido", () => {
    const now = new Date("2026-06-22T10:00:00.000Z"); // +1 día
    const fu = nextFollowUp(lead({ followUpsSent: ["2h"] }), config, now);
    expect(fu?.threshold).toBe("1d");
  });

  it("envía en orden: con 2h y 1d ya enviados y +3d, toca '3d'", () => {
    const now = new Date("2026-06-24T10:00:00.000Z"); // +3 días
    const fu = nextFollowUp(lead({ followUpsSent: ["2h", "1d"] }), config, now);
    expect(fu?.threshold).toBe("3d");
  });

  it("no hace seguimiento a leads cerrados (agendado/pagado/perdido)", () => {
    const now = new Date("2026-06-24T10:00:00.000Z");
    expect(nextFollowUp(lead({ state: "agendado" }), config, now)).toBeNull();
    expect(nextFollowUp(lead({ state: "perdido" }), config, now)).toBeNull();
    expect(nextFollowUp(lead({ state: "pagado" }), config, now)).toBeNull();
  });

  it("cuando ya se enviaron todos, no hay más", () => {
    const now = new Date("2026-06-30T10:00:00.000Z");
    expect(
      nextFollowUp(lead({ followUpsSent: ["2h", "1d", "3d"] }), config, now),
    ).toBeNull();
  });
});

describe("dueFollowUps", () => {
  it("calcula a lo sumo un seguimiento por lead", () => {
    const now = new Date("2026-06-21T12:30:00.000Z"); // +2.5h
    const leads = [
      lead({ id: "a" }),
      lead({ id: "b", state: "agendado" }), // cerrado → sin seguimiento
      lead({ id: "c", lastInboundAt: "2026-06-21T12:00:00.000Z" }), // +0.5h → aún no
    ];
    const result = dueFollowUps(leads, config, now);
    expect(result).toHaveLength(1);
    expect(result[0].leadId).toBe("a");
    expect(result[0].threshold).toBe("2h");
  });
});
