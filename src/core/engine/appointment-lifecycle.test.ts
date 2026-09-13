import { describe, expect, it } from "vitest";
import {
  SIN_FECHA_EXACTA_DIAS,
  cerrarCitaCumplida,
  citaCumplida,
} from "@/core/engine/appointment-lifecycle";
import type { Lead } from "@/core/types";

const TZ = "America/Bogota";

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "1",
    businessSlug: "estetica-bella",
    channel: "mock",
    contact: "57300000000",
    name: "Laura",
    serviceId: "limpieza-facial",
    state: "agendado",
    stage: "datos_completos",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    lastInboundAt: "2026-06-01T00:00:00.000Z",
    followUpsSent: [],
    ...overrides,
  };
}

describe("citaCumplida", () => {
  it("con cita hoy a las 15:00, consultada el mismo día a las 19:00 → NO cumplida (mismo día)", () => {
    const lead = baseLead({ appointmentAt: "2026-06-30T15:00:00-05:00" });
    const now = new Date("2026-06-30T19:00:00-05:00");
    expect(citaCumplida(lead, now, TZ)).toBe(false);
  });

  it("con cita de ayer → cumplida (ya pasó el fin del día de la cita)", () => {
    const lead = baseLead({ appointmentAt: "2026-06-30T15:00:00-05:00" });
    const now = new Date("2026-07-01T00:30:00-05:00");
    expect(citaCumplida(lead, now, TZ)).toBe(true);
  });

  it("sin fecha exacta, con confirmedAt: a los 6 días NO está cumplida", () => {
    const lead = baseLead({ confirmedAt: "2026-06-01T00:00:00.000Z" });
    const now = new Date("2026-06-07T00:00:00.000Z"); // 6 días
    expect(citaCumplida(lead, now, TZ)).toBe(false);
  });

  it("sin fecha exacta, con confirmedAt: a los 8 días SÍ está cumplida", () => {
    const lead = baseLead({ confirmedAt: "2026-06-01T00:00:00.000Z" });
    const now = new Date("2026-06-09T00:00:00.000Z"); // 8 días
    expect(citaCumplida(lead, now, TZ)).toBe(true);
  });

  it("sin appointmentAt ni confirmedAt (leads previos a la migración): usa updatedAt a los 7 días", () => {
    const lead = baseLead({ updatedAt: "2026-06-01T00:00:00.000Z" });
    const now = new Date("2026-06-09T00:00:00.000Z");
    expect(citaCumplida(lead, now, TZ)).toBe(true);
  });

  it("un lead que todavía está esperando la fecha nunca se da por cumplido", () => {
    const lead = baseLead({
      stage: "esperando_fecha",
      state: "interesado",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const now = new Date("2026-06-30T00:00:00.000Z");
    expect(citaCumplida(lead, now, TZ)).toBe(false);
  });

  it("SIN_FECHA_EXACTA_DIAS es 7", () => {
    expect(SIN_FECHA_EXACTA_DIAS).toBe(7);
  });
});

describe("cerrarCitaCumplida", () => {
  it("conserva el nombre y la identidad, limpia los datos de la reserva y pasa a recurrente/inicio", () => {
    const lead = baseLead({
      appointmentAt: "2026-06-01T15:00:00-05:00",
      confirmedAt: "2026-05-28T00:00:00.000Z",
      followUpsSent: ["1d"],
      offTopicCount: 2,
    });
    const now = new Date("2026-06-02T05:00:00.000Z");

    const cerrado = cerrarCitaCumplida(lead, now);

    expect(cerrado.id).toBe(lead.id);
    expect(cerrado.contact).toBe(lead.contact);
    expect(cerrado.createdAt).toBe(lead.createdAt);
    expect(cerrado.name).toBe("Laura");
    expect(cerrado.state).toBe("recurrente");
    expect(cerrado.stage).toBe("inicio");
    expect(cerrado.serviceId).toBeUndefined();
    expect(cerrado.tentativeDate).toBeUndefined();
    expect(cerrado.entrega).toBeUndefined();
    expect(cerrado.appointmentAt).toBeUndefined();
    expect(cerrado.confirmedAt).toBeUndefined();
    expect(cerrado.followUpsSent).toEqual([]);
    expect(cerrado.offTopicCount).toBe(0);
    expect(cerrado.updatedAt).toBe(now.toISOString());
  });
});
