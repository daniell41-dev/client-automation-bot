import { describe, expect, it } from "vitest";
import { formatoPrecio } from "@/core/moneda";

const sinNbsp = (t: string) => t.replace(/ /g, " ");

describe("formatoPrecio", () => {
  it("pesos colombianos, como siempre", () => {
    expect(sinNbsp(formatoPrecio(129900, "COP", "es-CO"))).toBe("$ 129.900");
  });

  it("T-153: bolívares como los escribe la gente en Venezuela («Bs. 3.850»), no «VES 3.850» ni el viejo «Bs.S»", () => {
    expect(formatoPrecio(3850, "VES", "es-CO")).toBe("Bs. 3.850");
    expect(formatoPrecio(3850, "VES", "es-VE")).toBe("Bs. 3.850");
  });

  it("una moneda que Intl no conoce no rompe nada", () => {
    expect(formatoPrecio(10, "XYZW")).toBe("10 XYZW");
  });
});
