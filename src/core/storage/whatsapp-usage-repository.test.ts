import { describe, expect, it } from "vitest";
import { mesDeUso } from "@/core/storage/whatsapp-usage-repository";

describe("mesDeUso", () => {
  it("devuelve el primer día del mes", () => {
    expect(mesDeUso(new Date("2026-10-15T15:00:00Z"))).toBe("2026-10-01");
  });

  it("usa la hora de Colombia: el 31 a la noche sigue siendo ese mes", () => {
    // 2026-11-01 02:00 UTC = 2026-10-31 21:00 en Bogotá.
    expect(mesDeUso(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-01");
  });
});
