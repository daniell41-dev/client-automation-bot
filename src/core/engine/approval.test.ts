import { describe, expect, it } from "vitest";
import { interpretarRespuestaDueña } from "@/core/engine/approval";

describe("interpretarRespuestaDueña", () => {
  it("reconoce una aceptación", () => {
    expect(interpretarRespuestaDueña("sí")).toBe("aceptado");
    expect(interpretarRespuestaDueña("dale")).toBe("aceptado");
    expect(interpretarRespuestaDueña("confirmo")).toBe("aceptado");
  });

  it("reconoce un rechazo", () => {
    expect(interpretarRespuestaDueña("no")).toBe("rechazado");
    expect(interpretarRespuestaDueña("rechazo")).toBe("rechazado");
    expect(interpretarRespuestaDueña("cancelalo")).toBe("rechazado");
  });

  it("un mensaje ambiguo devuelve null (no acepta ni rechaza por accidente)", () => {
    expect(interpretarRespuestaDueña("quién es?")).toBeNull();
    expect(interpretarRespuestaDueña("")).toBeNull();
  });
});
