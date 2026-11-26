import { describe, expect, it } from "vitest";
import { quitarTratamientoAdivinado } from "@/core/ai/trato";

describe("T-115b: quitarTratamientoAdivinado", () => {
  it.each([
    ["¡Muchas gracias, don/doña Valero!", "¡Muchas gracias, Valero!"],
    ["Hola doña/don Ana, ¿qué le provoca?", "Hola Ana, ¿qué le provoca?"],
    ["Listo, señor(a) Pérez.", "Listo, Pérez."],
    ["Gracias, sr./sra. Gómez", "Gracias, Gómez"],
  ])("«%s» → «%s»", (antes, despues) => {
    expect(quitarTratamientoAdivinado(antes)).toBe(despues);
  });

  it("no toca un «don» de verdad ni otras palabras", () => {
    expect(quitarTratamientoAdivinado("Don Pedro le manda saludos")).toBe("Don Pedro le manda saludos");
    expect(quitarTratamientoAdivinado("Tenemos donas y doñas recetas")).toBe("Tenemos donas y doñas recetas");
  });
});
