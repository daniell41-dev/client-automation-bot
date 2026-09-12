import { describe, expect, it } from "vitest";
import { ultimoInicioPosible, validarCita } from "@/core/engine/horarios";
import type { DiaAtencion } from "@/core/types";

const TZ = "America/Bogota"; // UTC-5, sin horario de verano — simplifica los ISO de los tests

/** Horario con corte de mediodía lunes a viernes, sábado corrido, domingo cerrado. */
const HORARIOS: DiaAtencion[] = [
  { dow: 0, abierto: false, tramos: [] }, // domingo
  { dow: 1, abierto: true, tramos: [{ desde: "09:00", hasta: "13:00" }, { desde: "15:00", hasta: "19:00" }] },
  { dow: 2, abierto: true, tramos: [{ desde: "09:00", hasta: "13:00" }, { desde: "15:00", hasta: "19:00" }] },
  { dow: 3, abierto: true, tramos: [{ desde: "09:00", hasta: "13:00" }, { desde: "15:00", hasta: "19:00" }] },
  { dow: 4, abierto: true, tramos: [{ desde: "09:00", hasta: "13:00" }, { desde: "15:00", hasta: "19:00" }] },
  { dow: 5, abierto: true, tramos: [{ desde: "09:00", hasta: "13:00" }, { desde: "15:00", hasta: "19:00" }] },
  { dow: 6, abierto: true, tramos: [{ desde: "09:00", hasta: "14:00" }] }, // sábado corrido
];

// 2026-07-11 es sábado; 2026-07-12 domingo; 2026-07-13 lunes (verificado con `date`).
function bogota(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00-05:00`;
}

describe("validarCita", () => {
  it("sin horarios cargados: siempre válida", () => {
    expect(validarCita(bogota("2026-07-11", "23:00"), 60, undefined, TZ)).toEqual({ ok: true });
    expect(validarCita(bogota("2026-07-11", "23:00"), 60, [], TZ)).toEqual({ ok: true });
  });

  it("domingo cerrado → cerrado_ese_dia", () => {
    const r = validarCita(bogota("2026-07-12", "10:00"), 60, HORARIOS, TZ);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("cerrado_ese_dia");
      expect(r.alternativa).toContain("domingo");
      expect(r.alternativa).toContain("sábado");
    }
  });

  it("sábado 15:00 con cierre a las 14:00 → fuera_de_horario", () => {
    const r = validarCita(bogota("2026-07-11", "15:00"), 30, HORARIOS, TZ);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("fuera_de_horario");
  });

  it("sábado 13:30 con servicio de 60 min (cierra 14:00) → no_termina_antes_del_cierre", () => {
    const r = validarCita(bogota("2026-07-11", "13:30"), 60, HORARIOS, TZ);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("no_termina_antes_del_cierre");
      expect(r.alternativa).toContain("13:00"); // último inicio posible para 60 min
    }
  });

  it("sábado 13:00 con servicio de 60 min → ok (termina justo a las 14:00)", () => {
    expect(validarCita(bogota("2026-07-11", "13:00"), 60, HORARIOS, TZ)).toEqual({ ok: true });
  });

  it("14:00 en el corte de mediodía (13-15 libre) → fuera_de_horario", () => {
    const r = validarCita(bogota("2026-07-13", "14:00"), 30, HORARIOS, TZ); // lunes
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("fuera_de_horario");
  });

  it("un tramo de la tarde funciona igual que el de la mañana", () => {
    expect(validarCita(bogota("2026-07-13", "16:00"), 60, HORARIOS, TZ)).toEqual({ ok: true });
  });

  it("un negocio sin horario ese día específico (dow ausente del array) trata el día como cerrado", () => {
    const sinDomingo = HORARIOS.filter((d) => d.dow !== 0);
    const r = validarCita(bogota("2026-07-12", "10:00"), 30, sinDomingo, TZ);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("cerrado_ese_dia");
  });
});

describe("ultimoInicioPosible", () => {
  it("el último inicio de un tramo simple es hasta - duración", () => {
    const dia: DiaAtencion = { dow: 6, abierto: true, tramos: [{ desde: "09:00", hasta: "14:00" }] };
    expect(ultimoInicioPosible(dia, 60)).toBe("13:00");
  });

  it("con varios tramos, elige el mejor (más tarde) entre los que alcanzan", () => {
    const dia: DiaAtencion = {
      dow: 1,
      abierto: true,
      tramos: [
        { desde: "09:00", hasta: "13:00" },
        { desde: "15:00", hasta: "19:00" },
      ],
    };
    expect(ultimoInicioPosible(dia, 60)).toBe("18:00");
  });

  it("null si ningún tramo alcanza para esa duración", () => {
    const dia: DiaAtencion = { dow: 6, abierto: true, tramos: [{ desde: "09:00", hasta: "09:30" }] };
    expect(ultimoInicioPosible(dia, 60)).toBeNull();
  });

  it("null si el día no tiene tramos", () => {
    expect(ultimoInicioPosible({ dow: 0, abierto: false, tramos: [] }, 30)).toBeNull();
  });
});
