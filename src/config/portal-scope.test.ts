import { describe, expect, it } from "vitest";
import { PORTAL_SECCIONES_OCULTAS, seccionVisible } from "@/config/portal-scope";

describe("seccionVisible (T-16, reactivación de citas en T-20)", () => {
  it("respuestas y conversaciones siguen ocultas", () => {
    expect(seccionVisible("respuestas")).toBe(false);
    expect(seccionVisible("conversaciones")).toBe(false);
  });

  it("resumen, catálogo, citas y configuración son visibles", () => {
    expect(seccionVisible("resumen")).toBe(true);
    expect(seccionVisible("catalogo")).toBe(true);
    expect(seccionVisible("citas")).toBe(true);
    expect(seccionVisible("configuracion")).toBe(true);
  });

  it("el sidebar termina con exactamente 4 secciones visibles", () => {
    const todas = ["resumen", "catalogo", "citas", "respuestas", "conversaciones", "configuracion"] as const;
    const visibles = todas.filter(seccionVisible);
    expect(visibles).toEqual(["resumen", "catalogo", "citas", "configuracion"]);
  });

  it("PORTAL_SECCIONES_OCULTAS sigue siendo exactamente esas dos (si cambia, hay que revisar el criterio de T-16/T-20)", () => {
    expect(PORTAL_SECCIONES_OCULTAS).toEqual(["respuestas", "conversaciones"]);
  });
});
