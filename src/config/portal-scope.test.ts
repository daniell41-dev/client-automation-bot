import { describe, expect, it } from "vitest";
import { PORTAL_SECCIONES_OCULTAS, seccionVisible } from "@/config/portal-scope";

describe("seccionVisible (T-16)", () => {
  it("las tres secciones ocultas del alcance v1 no son visibles", () => {
    expect(seccionVisible("citas")).toBe(false);
    expect(seccionVisible("respuestas")).toBe(false);
    expect(seccionVisible("conversaciones")).toBe(false);
  });

  it("resumen, catálogo y configuración sí son visibles", () => {
    expect(seccionVisible("resumen")).toBe(true);
    expect(seccionVisible("catalogo")).toBe(true);
    expect(seccionVisible("configuracion")).toBe(true);
  });

  it("el sidebar termina con exactamente 3 secciones visibles", () => {
    const todas = ["resumen", "catalogo", "citas", "respuestas", "conversaciones", "configuracion"] as const;
    const visibles = todas.filter(seccionVisible);
    expect(visibles).toEqual(["resumen", "catalogo", "configuracion"]);
  });

  it("PORTAL_SECCIONES_OCULTAS sigue siendo exactamente esas tres (si cambia, hay que revisar el criterio de T-16)", () => {
    expect(PORTAL_SECCIONES_OCULTAS).toEqual(["citas", "respuestas", "conversaciones"]);
  });
});
