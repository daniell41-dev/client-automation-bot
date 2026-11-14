import { describe, expect, it } from "vitest";
import { precioNumerico } from "@/lib/precio";

describe("precioNumerico (T-89)", () => {
  it("convierte el precio en pesos a número (los puntos son de miles)", () => {
    expect(precioNumerico("$79.900")).toBe(79900);
    expect(precioNumerico("desde $1.250.000")).toBe(1250000);
    expect(precioNumerico("$ 59 900")).toBe(59900);
  });

  it("sin precio o sin números no inventa nada", () => {
    expect(precioNumerico(null)).toBeNull();
    expect(precioNumerico(undefined)).toBeNull();
    expect(precioNumerico("Pregúntenos")).toBeNull();
  });
});
