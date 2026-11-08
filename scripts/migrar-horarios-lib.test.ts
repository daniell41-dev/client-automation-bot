import { describe, expect, it } from "vitest";
import { convertirDia, convertirHorarios, esFormatoViejo } from "./migrar-horarios-lib";

describe("esFormatoViejo", () => {
  it("detecta el formato viejo (día en texto)", () => {
    expect(
      esFormatoViejo([{ dia: "Lunes a viernes", desde: "09:00", hasta: "19:00", abierto: true }]),
    ).toBe(true);
  });

  it("NO detecta como viejo el formato nuevo (dow numérico)", () => {
    expect(esFormatoViejo([{ dow: 1, abierto: true, tramos: [] }])).toBe(false);
  });

  it("undefined/vacío no es formato viejo (nada que convertir)", () => {
    expect(esFormatoViejo(undefined)).toBe(false);
    expect(esFormatoViejo([])).toBe(false);
  });
});

describe("convertirDia", () => {
  it("convierte los 3 casos conocidos del repo", () => {
    expect(convertirDia({ dia: "Lunes a viernes", desde: "09:00", hasta: "19:00", abierto: true }))
      .toEqual([
        { dow: 1, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] },
        { dow: 2, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] },
        { dow: 3, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] },
        { dow: 4, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] },
        { dow: 5, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] },
      ]);
    expect(convertirDia({ dia: "Sábado", desde: "09:00", hasta: "14:00", abierto: true })).toEqual([
      { dow: 6, abierto: true, tramos: [{ desde: "09:00", hasta: "14:00" }] },
    ]);
    expect(
      convertirDia({ dia: "Domingo", desde: "00:00", hasta: "00:00", abierto: false }),
    ).toEqual([{ dow: 0, abierto: false, tramos: [] }]);
  });

  it("no distingue mayúsculas ni espacios extra", () => {
    expect(convertirDia({ dia: "  sábado  ", desde: "09:00", hasta: "14:00", abierto: true })).toEqual([
      { dow: 6, abierto: true, tramos: [{ desde: "09:00", hasta: "14:00" }] },
    ]);
  });

  it("devuelve null si el día no se reconoce", () => {
    expect(
      convertirDia({ dia: "Findes", desde: "09:00", hasta: "14:00", abierto: true }),
    ).toBeNull();
  });
});

describe("convertirHorarios", () => {
  it("convierte una lista completa reconocida", () => {
    const resultado = convertirHorarios([
      { dia: "Lunes a viernes", desde: "09:00", hasta: "19:00", abierto: true },
      { dia: "Sábado", desde: "09:00", hasta: "14:00", abierto: true },
      { dia: "Domingo", desde: "00:00", hasta: "00:00", abierto: false },
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.horarios).toHaveLength(7); // 5 días de semana + sábado + domingo
    }
  });

  it("si UNA entrada no se reconoce, no convierte nada y lista los no convertidos", () => {
    const resultado = convertirHorarios([
      { dia: "Sábado", desde: "09:00", hasta: "14:00", abierto: true },
      { dia: "Findes", desde: "09:00", hasta: "14:00", abierto: true },
    ]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.noConvertidos).toEqual(["Findes"]);
    }
  });
});
