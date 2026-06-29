import { describe, expect, it } from "vitest";
import {
  buildDateExtractionPrompt,
  parseExtractedDateTime,
} from "@/core/ai/date-extraction";

describe("buildDateExtractionPrompt", () => {
  const prompt = buildDateExtractionPrompt({
    nowISO: "2026-06-29T10:00:00.000Z",
    timezone: "America/Bogota",
  });

  it("incluye la fecha de hoy y la zona horaria para resolver relativos", () => {
    expect(prompt).toContain("2026-06-29T10:00:00.000Z");
    expect(prompt).toContain("America/Bogota");
  });

  it("instruye a responder SOLO ISO 8601 o NONE", () => {
    expect(prompt).toMatch(/ISO 8601/i);
    expect(prompt).toMatch(/NONE/);
  });
});

describe("parseExtractedDateTime", () => {
  it("acepta un ISO 8601 con offset", () => {
    expect(parseExtractedDateTime("2026-06-30T15:00:00-05:00")).toBe(
      "2026-06-30T15:00:00-05:00",
    );
  });

  it("acepta un ISO 8601 en UTC (Z)", () => {
    expect(parseExtractedDateTime("2026-06-30T20:00:00Z")).toBe(
      "2026-06-30T20:00:00Z",
    );
  });

  it("limpia comillas, backticks y espacios alrededor", () => {
    expect(parseExtractedDateTime('  "2026-06-30T15:00:00-05:00"  ')).toBe(
      "2026-06-30T15:00:00-05:00",
    );
    expect(parseExtractedDateTime("`2026-06-30T15:00:00-05:00`")).toBe(
      "2026-06-30T15:00:00-05:00",
    );
  });

  it("devuelve null para NONE (en cualquier caso)", () => {
    expect(parseExtractedDateTime("NONE")).toBeNull();
    expect(parseExtractedDateTime("none")).toBeNull();
  });

  it("devuelve null para texto basura", () => {
    expect(parseExtractedDateTime("el viernes a las 3")).toBeNull();
    expect(parseExtractedDateTime("")).toBeNull();
  });

  it("rechaza fecha sin hora (necesitamos un horario para la cita)", () => {
    expect(parseExtractedDateTime("2026-06-30")).toBeNull();
  });

  it("rechaza fecha y hora SIN offset (evita zona horaria equivocada)", () => {
    expect(parseExtractedDateTime("2026-06-30T15:00:00")).toBeNull();
  });

  it("rechaza un ISO con forma válida pero fecha imposible", () => {
    expect(parseExtractedDateTime("2026-13-40T15:00:00-05:00")).toBeNull();
  });
});
