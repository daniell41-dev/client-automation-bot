import { describe, expect, it } from "vitest";
import { generarCodigoRetiro, mensajeCodigoRetiro } from "@/core/engine/codigo-retiro";

describe("generarCodigoRetiro", () => {
  it("siempre son 4 dígitos", () => {
    expect(generarCodigoRetiro(() => 0)).toBe("1000");
    expect(generarCodigoRetiro(() => 0.99999)).toBe("9999");
    for (let i = 0; i < 50; i++) expect(generarCodigoRetiro()).toMatch(/^\d{4}$/);
  });
});

describe("mensajeCodigoRetiro", () => {
  it("para recoger y para domicilio dice cuándo mostrarlo", () => {
    expect(mensajeCodigoRetiro(12, "4821", "Recoger en el local")).toBe(
      "Tu pedido #12 · código de retiro: 4821. Mostralo al recoger tu pedido.",
    );
    expect(mensajeCodigoRetiro(12, "4821", "Domicilio")).toContain("Dáselo a quien te lo entregue");
  });
});
