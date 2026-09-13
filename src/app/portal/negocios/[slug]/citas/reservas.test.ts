import { describe, expect, it } from "vitest";
import { splitReservas, type Reserva } from "./reservas";

const now = new Date("2026-06-30T12:00:00.000Z");

function reserva(id: string, appointmentAt: string | null): Reserva {
  return { id, nombre: `Cliente ${id}`, servicio: "Limpieza facial", fecha: "—", appointmentAt };
}

describe("splitReservas", () => {
  it("una cita futura va a próximas", () => {
    const { proximas, pasadas } = splitReservas([reserva("1", "2026-07-01T15:00:00.000Z")], now);
    expect(proximas.map((r) => r.id)).toEqual(["1"]);
    expect(pasadas).toHaveLength(0);
  });

  it("una cita ya pasada va a pasadas", () => {
    const { proximas, pasadas } = splitReservas([reserva("1", "2026-06-29T15:00:00.000Z")], now);
    expect(pasadas.map((r) => r.id)).toEqual(["1"]);
    expect(proximas).toHaveLength(0);
  });

  it("sin fecha exacta (appointmentAt null) se cuenta como próxima", () => {
    const { proximas, pasadas } = splitReservas([reserva("1", null)], now);
    expect(proximas.map((r) => r.id)).toEqual(["1"]);
    expect(pasadas).toHaveLength(0);
  });

  it("próximas quedan ordenadas de la más cercana a la más lejana, sin fecha al final", () => {
    const { proximas } = splitReservas(
      [
        reserva("lejana", "2026-08-01T00:00:00.000Z"),
        reserva("sin-fecha", null),
        reserva("cercana", "2026-07-01T00:00:00.000Z"),
      ],
      now,
    );
    expect(proximas.map((r) => r.id)).toEqual(["cercana", "lejana", "sin-fecha"]);
  });

  it("pasadas quedan ordenadas de la más reciente a la más vieja", () => {
    const { pasadas } = splitReservas(
      [
        reserva("vieja", "2026-06-01T00:00:00.000Z"),
        reserva("reciente", "2026-06-29T00:00:00.000Z"),
      ],
      now,
    );
    expect(pasadas.map((r) => r.id)).toEqual(["reciente", "vieja"]);
  });
});
