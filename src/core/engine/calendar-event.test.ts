import { describe, expect, it } from "vitest";
import { buildCalendarEvent } from "@/core/engine/calendar-event";
import type { Lead, Service } from "@/core/types";

const service: Service = {
  id: "limpieza-facial",
  name: "Limpieza facial",
  description: "x",
  price: 120000,
  durationMinutes: 60,
};

function makeLead(over: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    businessSlug: "estetica-bella",
    channel: "whatsapp",
    contact: "57300",
    name: "Laura",
    serviceId: "limpieza-facial",
    tentativeDate: "mañana a las 3",
    state: "agendado",
    stage: "datos_completos",
    createdAt: "2026-06-29T10:00:00.000Z",
    updatedAt: "2026-06-29T10:00:00.000Z",
    lastInboundAt: "2026-06-29T10:00:00.000Z",
    followUpsSent: [],
    ...over,
  };
}

describe("buildCalendarEvent", () => {
  it("arma el título con servicio y nombre del cliente", () => {
    const ev = buildCalendarEvent(
      makeLead(),
      service,
      "2026-06-30T15:00:00-05:00",
      "America/Bogota",
    );
    expect(ev.summary).toBe("Limpieza facial - Laura");
  });

  it("calcula el fin sumando la duración del servicio al inicio", () => {
    const ev = buildCalendarEvent(
      makeLead(),
      service, // 60 min
      "2026-06-30T15:00:00-05:00",
      "America/Bogota",
    );
    // 15:00-05:00 == 20:00Z; +60min == 21:00Z
    expect(new Date(ev.endISO).getTime()).toBe(
      new Date("2026-06-30T21:00:00.000Z").getTime(),
    );
  });

  it("respeta duraciones distintas (depilación 30 min)", () => {
    const dep: Service = { ...service, name: "Depilación", durationMinutes: 30 };
    const ev = buildCalendarEvent(
      makeLead(),
      dep,
      "2026-06-30T15:00:00-05:00",
      "America/Bogota",
    );
    expect(new Date(ev.endISO).getTime()).toBe(
      new Date("2026-06-30T20:30:00.000Z").getTime(),
    );
  });

  it("preserva el inicio y la zona horaria recibidos", () => {
    const ev = buildCalendarEvent(
      makeLead(),
      service,
      "2026-06-30T15:00:00-05:00",
      "America/Bogota",
    );
    expect(ev.startISO).toBe("2026-06-30T15:00:00-05:00");
    expect(ev.timezone).toBe("America/Bogota");
  });

  it("incluye el texto original de la fecha y el contacto en la descripción", () => {
    const ev = buildCalendarEvent(
      makeLead({ tentativeDate: "el viernes a las 3" }),
      service,
      "2026-06-30T15:00:00-05:00",
      "America/Bogota",
    );
    expect(ev.description).toContain("el viernes a las 3");
    expect(ev.description).toContain("57300");
  });

  it("usa el contacto como título si el lead no tiene nombre", () => {
    const ev = buildCalendarEvent(
      makeLead({ name: undefined }),
      service,
      "2026-06-30T15:00:00-05:00",
      "America/Bogota",
    );
    expect(ev.summary).toBe("Limpieza facial - 57300");
  });
});
