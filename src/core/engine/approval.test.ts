import { describe, expect, it } from "vitest";
import { interpretarDecisionDueña, interpretarRespuestaDueña } from "@/core/engine/approval";

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

describe("interpretarDecisionDueña (T-31)", () => {
  it("el botón manda: trae el id del pedido", () => {
    expect(interpretarDecisionDueña("Aprobar #12", "aprobar:ped-1")).toEqual({ decision: "aceptado", pedidoId: "ped-1" });
    expect(interpretarDecisionDueña("Rechazar #12", "rechazar:ped-1")).toEqual({ decision: "rechazado", pedidoId: "ped-1" });
  });

  it("en el texto reconoce el número del pedido", () => {
    expect(interpretarDecisionDueña("sí 12")).toEqual({ decision: "aceptado", numero: 12 });
    expect(interpretarDecisionDueña("NO #7")).toEqual({ decision: "rechazado", numero: 7 });
    expect(interpretarDecisionDueña("Aprobar #3")).toEqual({ decision: "aceptado", numero: 3 });
    expect(interpretarDecisionDueña("rechazar 4")).toEqual({ decision: "rechazado", numero: 4 });
  });

  it("sin número devuelve solo la decisión", () => {
    expect(interpretarDecisionDueña("sí")).toEqual({ decision: "aceptado" });
  });

  it("un número sin decisión no aprueba nada", () => {
    expect(interpretarDecisionDueña("12")).toBeNull();
    expect(interpretarDecisionDueña("quién es el 12?")).toBeNull();
  });
});
