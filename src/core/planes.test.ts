import { describe, expect, it } from "vitest";
import {
  FUNCIONES_POR_PLAN,
  NOMBRE_PLAN,
  PLAN_POR_DEFECTO,
  PLANES,
  planAlcanza,
  planDe,
  nivelPlan,
  planMinimoPara,
  puede,
} from "@/core/planes";

describe("planes (T-127)", () => {
  it("son tres, de menor a mayor: Plus, Pro, Premium", () => {
    expect(PLANES).toEqual(["plus", "pro", "premium"]);
    expect(PLANES.map((p) => NOMBRE_PLAN[p])).toEqual(["Plus", "Pro", "Premium"]);
  });

  it("un negocio nace en Plus, el plan de entrada", () => {
    expect(PLAN_POR_DEFECTO).toBe("plus");
    expect(nivelPlan(PLAN_POR_DEFECTO)).toBe(0);
  });

  it("planDe acepta los tres planes y manda todo lo demás al plan por defecto", () => {
    expect(planDe("premium")).toBe("premium");
    expect(planDe("pro")).toBe("pro");
    // "free" era la etiqueta vieja del back office: ya no existe.
    expect(planDe("free")).toBe("plus");
    expect(planDe(undefined)).toBe("plus");
    expect(planDe("PREMIUM")).toBe("plus");
  });

  it("un plan alcanza a los de abajo y no a los de arriba", () => {
    expect(planAlcanza("premium", "pro")).toBe(true);
    expect(planAlcanza("pro", "pro")).toBe(true);
    expect(planAlcanza("plus", "pro")).toBe(false);
  });

  it("todavía no hay funciones asignadas a ningún plan", () => {
    for (const plan of PLANES) expect(FUNCIONES_POR_PLAN[plan]).toEqual([]);
  });

  it("sin funciones asignadas, ningún plan habilita nada todavía", () => {
    // `Funcion` todavía no admite valores: se fuerza el tipo solo para el test.
    const cualquiera = "wompi" as never;
    expect(puede("premium", cualquiera)).toBe(false);
    expect(planMinimoPara(cualquiera)).toBeNull();
  });
});
