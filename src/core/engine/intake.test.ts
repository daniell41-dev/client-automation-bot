import { describe, expect, it } from "vitest";
import {
  availableServices,
  isAffirmative,
  isGreeting,
  isMenuRequest,
  isResetRequest,
  looksLikeDate,
  matchEntrega,
  matchRule,
  matchService,
  normalize,
  normalizeDateText,
  normalizeMessage,
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

  it("detecta saludos escritos en español de chat", () => {
    expect(isGreeting("hla")).toBe(true);
    expect(isGreeting("wenas")).toBe(true);
    expect(isGreeting("holaaa")).toBe(true);
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

  it("reconoce variantes regionales y letras repetidas", () => {
    expect(isAffirmative("siii")).toBe(true);
    expect(isAffirmative("vale")).toBe(true);
    expect(isAffirmative("simon")).toBe(true);
    expect(isAffirmative("sisas")).toBe(true);
    expect(isAffirmative("sale")).toBe(true);
    expect(isAffirmative("hecho")).toBe(true);
  });
});

describe("normalizeMessage", () => {
  it("expande el español de chat antes de comparar", () => {
    expect(normalizeMessage("K PASA SI?")).toBe("que pasa si ?");
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

  it("reconoce el servicio aunque el cliente escriba en español de chat", () => {
    expect(matchService("hla, kiero info d unas xfa", services)?.id).toBe(
      "unas",
    );
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

describe("normalizeDateText", () => {
  it("quita muletillas iniciales y puntuación suelta", () => {
    expect(normalizeDateText("Puede ser hoy ?")).toBe("hoy");
  });

  it("expande abreviaturas y conserva la tilde del reemplazo", () => {
    expect(normalizeDateText("Podría ser mñn a las 3 pm!")).toBe(
      "mañana a las 3 pm",
    );
  });

  it("conserva tildes de palabras que no son abreviaturas", () => {
    expect(normalizeDateText("Creo que el sábado en la tarde.")).toBe(
      "el sábado en la tarde",
    );
  });

  it("no toca un texto que ya es una fecha natural", () => {
    expect(normalizeDateText("el viernes")).toBe("el viernes");
  });

  it("quita el filler 'para' para no duplicarlo con la plantilla", () => {
    expect(normalizeDateText("para mañana")).toBe("mañana");
  });

  it("devuelve vacío si el mensaje es solo puntuación o muletillas", () => {
    expect(normalizeDateText("???")).toBe("");
    expect(normalizeDateText("quiero")).toBe("");
  });

  it("encadena varias muletillas seguidas", () => {
    expect(normalizeDateText("Creo que quiero mañana")).toBe("mañana");
  });
});

describe("looksLikeDate", () => {
  it("reconoce días de la semana y relativos", () => {
    expect(looksLikeDate("hoy")).toBe(true);
    expect(looksLikeDate("mañana")).toBe(true);
    expect(looksLikeDate("el viernes")).toBe(true);
    expect(looksLikeDate("mañana en la tarde")).toBe(true);
    expect(looksLikeDate("el 15 de diciembre")).toBe(true);
  });

  it("reconoce horas y duraciones relativas", () => {
    expect(looksLikeDate("a las 3")).toBe(true);
    expect(looksLikeDate("3 pm")).toBe(true);
    expect(looksLikeDate("en 20 minutos")).toBe(true);
    expect(looksLikeDate("15/12")).toBe(true);
  });

  it("reconoce un número suelto (día del mes)", () => {
    expect(looksLikeDate("20")).toBe(true);
  });

  it("NO reconoce preguntas o texto sin relación con fechas", () => {
    expect(looksLikeDate("me repites por fa las opciones que hay")).toBe(false);
    expect(looksLikeDate("cambiar fecha")).toBe(false);
    expect(looksLikeDate("no se")).toBe(false);
    expect(looksLikeDate("")).toBe(false);
  });

  it("no matchea 'vaya'/'playa' por contener 'ya' como substring", () => {
    // Regresión: "ya" como señal de fecha por substring daba falsos positivos.
    expect(looksLikeDate("vaya, no sé qué día")).toBe(false);
    expect(looksLikeDate("nos vemos en la playa")).toBe(false);
  });
});

describe("isMenuRequest", () => {
  it("reconoce pedidos de menú/opciones", () => {
    expect(isMenuRequest("me repites las opciones?")).toBe(true);
    expect(isMenuRequest("qué servicios tienen")).toBe(true);
    expect(isMenuRequest("Me repites por fa las opciones que hay")).toBe(true);
  });

  it("no confunde una respuesta normal con un pedido de menú", () => {
    expect(isMenuRequest("Carlos")).toBe(false);
    expect(isMenuRequest("el viernes")).toBe(false);
  });
});

describe("isResetRequest", () => {
  it("reconoce pedidos de reinicio/cancelación", () => {
    expect(isResetRequest("cancelar")).toBe(true);
    expect(isResetRequest("quiero reiniciar")).toBe(true);
    expect(isResetRequest("empezar de nuevo por favor")).toBe(true);
  });

  it("no confunde una respuesta normal con un pedido de reinicio", () => {
    expect(isResetRequest("Carlos")).toBe(false);
    expect(isResetRequest("el viernes")).toBe(false);
  });
});
