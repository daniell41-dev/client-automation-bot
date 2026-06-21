import { describe, expect, it } from "vitest";
import {
  canTransition,
  needsFollowUp,
  nextAction,
  transition,
} from "@/core/engine/lead-state";

describe("canTransition", () => {
  it("permite avances válidos del embudo", () => {
    expect(canTransition("nuevo", "interesado")).toBe(true);
    expect(canTransition("interesado", "agendado")).toBe(true);
    expect(canTransition("agendado", "pagado")).toBe(true);
    expect(canTransition("pagado", "recurrente")).toBe(true);
  });

  it("permite marcar como perdido desde estados activos", () => {
    expect(canTransition("nuevo", "perdido")).toBe(true);
    expect(canTransition("interesado", "perdido")).toBe(true);
    expect(canTransition("agendado", "perdido")).toBe(true);
  });

  it("permite reactivar un lead perdido", () => {
    expect(canTransition("perdido", "interesado")).toBe(true);
  });

  it("rechaza saltos inválidos", () => {
    expect(canTransition("nuevo", "pagado")).toBe(false);
    expect(canTransition("pagado", "nuevo")).toBe(false);
    expect(canTransition("interesado", "recurrente")).toBe(false);
  });
});

describe("transition", () => {
  it("devuelve el nuevo estado cuando es válido", () => {
    expect(transition("nuevo", "interesado")).toBe("interesado");
  });

  it("es no-op cuando from === to", () => {
    expect(transition("interesado", "interesado")).toBe("interesado");
  });

  it("lanza ante una transición inválida", () => {
    expect(() => transition("nuevo", "pagado")).toThrow(/inválida/);
  });
});

describe("nextAction", () => {
  it("da una acción para cada estado", () => {
    const estados = [
      "nuevo",
      "interesado",
      "agendado",
      "pagado",
      "recurrente",
      "perdido",
    ] as const;
    for (const e of estados) {
      expect(nextAction(e)).toBeTruthy();
    }
  });
});

describe("needsFollowUp", () => {
  it("los leads abiertos necesitan seguimiento", () => {
    expect(needsFollowUp("nuevo")).toBe(true);
    expect(needsFollowUp("interesado")).toBe(true);
  });

  it("los leads cerrados no necesitan seguimiento", () => {
    expect(needsFollowUp("agendado")).toBe(false);
    expect(needsFollowUp("pagado")).toBe(false);
    expect(needsFollowUp("perdido")).toBe(false);
    expect(needsFollowUp("recurrente")).toBe(false);
  });
});
