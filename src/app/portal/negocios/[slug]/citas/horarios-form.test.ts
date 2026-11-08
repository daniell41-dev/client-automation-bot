import { describe, expect, it } from "vitest";
import { buildSieteFilas, NOMBRES_DIA, ORDEN_SEMANA } from "./horarios-form";
import type { DiaAtencion } from "@/core/types";

describe("buildSieteFilas", () => {
  it("sin horarios (undefined): devuelve 7 días, todos cerrados, en orden lunes→domingo", () => {
    const filas = buildSieteFilas(undefined);
    expect(filas).toHaveLength(7);
    expect(filas.map((f) => f.dow)).toEqual(ORDEN_SEMANA);
    expect(filas.every((f) => !f.abierto && f.tramos.length === 0)).toBe(true);
  });

  it("respeta los días que sí vienen configurados y completa el resto cerrado", () => {
    const horarios: DiaAtencion[] = [
      { dow: 1, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] },
      { dow: 6, abierto: true, tramos: [{ desde: "09:00", hasta: "14:00" }] },
    ];
    const filas = buildSieteFilas(horarios);
    const lunes = filas.find((f) => f.dow === 1)!;
    const sabado = filas.find((f) => f.dow === 6)!;
    const martes = filas.find((f) => f.dow === 2)!;

    expect(lunes.abierto).toBe(true);
    expect(lunes.tramos).toEqual([{ desde: "09:00", hasta: "19:00" }]);
    expect(sabado.tramos).toEqual([{ desde: "09:00", hasta: "14:00" }]);
    expect(martes.abierto).toBe(false); // no vino configurado
  });

  it("conserva varios tramos por día (corte de mediodía)", () => {
    const horarios: DiaAtencion[] = [
      {
        dow: 3,
        abierto: true,
        tramos: [
          { desde: "09:00", hasta: "13:00" },
          { desde: "15:00", hasta: "19:00" },
        ],
      },
    ];
    const filas = buildSieteFilas(horarios);
    expect(filas.find((f) => f.dow === 3)!.tramos).toHaveLength(2);
  });

  it("ignora un dow duplicado o fuera de rango sin lanzar", () => {
    const horarios: DiaAtencion[] = [
      { dow: 1, abierto: true, tramos: [{ desde: "08:00", hasta: "12:00" }] },
      { dow: 1, abierto: true, tramos: [{ desde: "99:99", hasta: "00:00" }] }, // duplicado, se ignora
      { dow: 9, abierto: true, tramos: [] } as unknown as DiaAtencion, // fuera de rango
    ];
    expect(() => buildSieteFilas(horarios)).not.toThrow();
    const filas = buildSieteFilas(horarios);
    expect(filas.find((f) => f.dow === 1)!.tramos[0].desde).toBe("08:00");
    expect(filas).toHaveLength(7);
  });

  it("NOMBRES_DIA cubre los 7 días", () => {
    for (const dow of ORDEN_SEMANA) {
      expect(NOMBRES_DIA[dow]).toBeTruthy();
    }
  });
});
