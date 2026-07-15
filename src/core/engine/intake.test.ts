import { describe, expect, it } from "vitest";
import {
  availableServices,
  isAffirmative,
  isGreeting,
  matchEntrega,
  matchRule,
  matchService,
  normalize,
} from "@/core/engine/intake";
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

describe("isAffirmative", () => {
  it("reconoce confirmaciones comunes", () => {
    expect(isAffirmative("sí")).toBe(true);
    expect(isAffirmative("Si, confirmar")).toBe(true);
    expect(isAffirmative("dale")).toBe(true);
    expect(isAffirmative("perfecto, confirmo")).toBe(true);
  });

  it("no confunde palabras que contienen 'si'", () => {
    expect(isAffirmative("siempre")).toBe(false);
    expect(isAffirmative("sin problema")).toBe(false);
  });

  it("trata cualquier otra cosa como no-confirmación", () => {
    expect(isAffirmative("Cambiar fecha")).toBe(false);
    expect(isAffirmative("no")).toBe(false);
    expect(isAffirmative("mejor el lunes")).toBe(false);
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

describe("availableServices y disponibilidad", () => {
  const conApagado: Service[] = [
    ...services,
    {
      id: "apagado",
      name: "Servicio apagado",
      description: "No se ofrece",
      price: 1000,
      durationMinutes: 30,
      keywords: ["apagado"],
      disponible: false,
    },
  ];

  it("excluye los servicios con disponible: false", () => {
    const ids = availableServices(conApagado).map((s) => s.id);
    expect(ids).toEqual(["limpieza-facial", "unas"]);
  });

  it("matchService no reconoce un servicio no disponible", () => {
    expect(matchService("quiero el servicio apagado", conApagado)).toBeUndefined();
  });

  it("la selección por número usa el índice del menú visible", () => {
    // El menú muestra 2 opciones; "2" es Uñas aunque haya 3 servicios en total.
    expect(matchService("2", conApagado)?.id).toBe("unas");
  });
});

describe("matchRule", () => {
  const reglas = [
    { keywords: ["horario", "abren"], respuesta: "De 9 a 20 h." },
    { keywords: ["envio", "delivery"], respuesta: "Enviamos a toda la ciudad." },
  ];

  it("encuentra la regla por keyword (sin tildes, dentro de una frase)", () => {
    expect(matchRule("¿Cuál es el horarió de atención?", reglas)?.respuesta).toBe(
      "De 9 a 20 h.",
    );
    expect(matchRule("hacen envíos?", reglas)?.respuesta).toBe(
      "Enviamos a toda la ciudad.",
    );
  });

  it("devuelve undefined sin coincidencia o sin reglas", () => {
    expect(matchRule("hola", reglas)).toBeUndefined();
    expect(matchRule("horario", undefined)).toBeUndefined();
    expect(matchRule("horario", [])).toBeUndefined();
  });
});

describe("matchEntrega", () => {
  const opciones = ["Retirar en el local", "Comer en el restaurante"];

  it("encuentra la opción por texto contenido", () => {
    expect(matchEntrega("prefiero retirar", opciones)).toBe("Retirar en el local");
    expect(matchEntrega("Quiero comer en el restaurante", opciones)).toBe(
      "Comer en el restaurante",
    );
  });

  it("encuentra la opción por número de la lista", () => {
    expect(matchEntrega("1", opciones)).toBe("Retirar en el local");
    expect(matchEntrega("la 2", opciones)).toBe("Comer en el restaurante");
  });

  it("devuelve undefined si no coincide con nada", () => {
    expect(matchEntrega("no sé", opciones)).toBeUndefined();
    expect(matchEntrega("5", opciones)).toBeUndefined();
  });
});
