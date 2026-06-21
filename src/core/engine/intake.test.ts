import { describe, expect, it } from "vitest";
import { isGreeting, matchService, normalize } from "@/core/engine/intake";
import type { Service } from "@/core/types";

const services: Service[] = [
  {
    id: "limpieza-facial",
    name: "Limpieza facial",
    description: "Limpieza profunda",
    price: 120000,
    durationMinutes: 60,
    keywords: ["facial", "limpieza"],
  },
  {
    id: "unas",
    name: "Uñas",
    description: "Manicure",
    price: 60000,
    durationMinutes: 45,
    keywords: ["manicure", "unas"],
  },
];

describe("normalize", () => {
  it("baja a minúsculas y quita tildes", () => {
    expect(normalize("  HÓLA Múndo ")).toBe("hola mundo");
  });
});

describe("isGreeting", () => {
  it("detecta saludos comunes", () => {
    expect(isGreeting("Hola, buenas")).toBe(true);
    expect(isGreeting("Buenos días")).toBe(true);
  });

  it("no marca como saludo un texto cualquiera", () => {
    expect(isGreeting("quiero precio")).toBe(false);
  });
});

describe("matchService", () => {
  it("encuentra por nombre", () => {
    expect(matchService("quiero una limpieza facial", services)?.id).toBe(
      "limpieza-facial",
    );
  });

  it("encuentra por palabra clave (sin tilde)", () => {
    expect(matchService("info de unas", services)?.id).toBe("unas");
  });

  it("encuentra por número de menú", () => {
    expect(matchService("2", services)?.id).toBe("unas");
  });

  it("prioriza nombre/keyword sobre número presente en el texto", () => {
    // Número "1" apunta al servicio 0, pero la keyword 'unas' (servicio 1)
    // es más específica y debe ganar.
    expect(matchService("dame el 1, info de uñas", services)?.id).toBe("unas");
  });

  it("devuelve undefined si no hay coincidencia", () => {
    expect(matchService("hola que tal", services)).toBeUndefined();
  });
});
