import { describe, expect, it } from "vitest";
import { ventanaAbierta } from "@/core/storage/ventana-duena-repository";

describe("ventanaAbierta (T-59)", () => {
  const ahora = new Date("2026-10-26T12:00:00Z");

  it("si la dueña nunca escribió, la ventana está cerrada", () => {
    expect(ventanaAbierta(undefined, ahora)).toBe(false);
  });

  it("abierta si escribió hace menos de 23,5 h, cerrada después", () => {
    expect(ventanaAbierta("2026-10-26T01:00:00Z", ahora)).toBe(true);
    expect(ventanaAbierta("2026-10-25T12:20:00Z", ahora)).toBe(false);
  });
});
