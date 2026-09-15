import { describe, expect, it } from "vitest";
import {
  availableServices,
  isAffirmative,
  isGreeting,
  isMenuRequest,
  isResetRequest,
  looksLikeDate,
  looksLikeDone,
  matchEntrega,
  matchRule,
  matchService,
  normalize,
  normalizeDateText,
  normalizeMessage,
  parseCantidad,
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

  it("acepta la variante regional con cortesía o puntuación alrededor", () => {
    expect(isAffirmative("vale!")).toBe(true);
    expect(isAffirmative("vale, gracias")).toBe(true);
    expect(isAffirmative("sale pues")).toBe(true);
    expect(isAffirmative("va, por favor")).toBe(true);
  });

  // Regresión: "sale"/"vale" son la forma normal de preguntar el precio en
  // media Latinoamérica, y "va" el verbo ir. Tomarlos como un "sí" hacía que
  // una pregunta de precio confirmara la cita, con evento de calendario y
  // aviso a la dueña incluidos.
  it("NO confirma cuando la palabra ambigua es parte de una pregunta", () => {
    expect(isAffirmative("¿cuánto sale?")).toBe(false);
    expect(isAffirmative("cuanto sale la limpieza")).toBe(false);
    expect(isAffirmative("¿cuánto vale?")).toBe(false);
    expect(isAffirmative("vale la pena?")).toBe(false);
    expect(isAffirmative("¿a qué hora sale?")).toBe(false);
    expect(isAffirmative("¿va a estar disponible el sábado?")).toBe(false);
    expect(isAffirmative("cuánto va a costar")).toBe(false);
    expect(isAffirmative("hecho un lío, no entiendo")).toBe(false);
  });

  // Al doblar el texto se pierde la tilde: el "sí" de confirmar y la
  // conjunción condicional quedan idénticos.
  it("NO confirma un 'si' condicional acompañado de duda o negación", () => {
    expect(isAffirmative("no sé si me sale bien")).toBe(false);
    expect(isAffirmative("si no puedo, te aviso")).toBe(false);
    expect(isAffirmative("quizás si consigo quien me cuide")).toBe(false);
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

  it("acepta la selección con palabras de selección y cortesía alrededor", () => {
    expect(matchService("la 2", services)?.id).toBe("unas");
    expect(matchService("opción 1", services)?.id).toBe("limpieza-facial");
    expect(matchService("quiero el 2", services)?.id).toBe("unas");
    expect(matchService("la 2 por favor", services)?.id).toBe("unas");
    expect(matchService("¿2?", services)?.id).toBe("unas");
  });

  // Regresión: el match por número buscaba CUALQUIER cifra de 1-2 dígitos en
  // cualquier parte del mensaje, así que una frase normal que mencionaba un
  // número elegía servicio y arrancaba el funnel sola. "gracias, nos vemos el
  // 2" era el peor caso: sobre una cita ya confirmada, la trataba como reserva
  // nueva y le borraba la fecha (ver el bloque `datos_completos` de responder).
  it("NO elige servicio por un número suelto dentro de una frase", () => {
    expect(matchService("somos 2 personas, se puede?", services)).toBeUndefined();
    expect(matchService("tengo 3 preguntas", services)).toBeUndefined();
    expect(matchService("puede ser a las 2", services)).toBeUndefined();
    expect(matchService("mi hija tiene 1 año", services)).toBeUndefined();
    expect(matchService("gracias, nos vemos el 2", services)).toBeUndefined();
    expect(matchService("el 2 de octubre puedo", services)).toBeUndefined();
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

  // Comparte `menuSelectionIndex` con matchService: mismo bug, misma guarda.
  it("NO elige modalidad por un número suelto dentro de una frase", () => {
    expect(matchEntrega("somos 2 personas", opciones)).toBeUndefined();
    expect(matchEntrega("llego 2 horas antes", opciones)).toBeUndefined();
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

  // Esta fecha se le muestra de vuelta al cliente en la plantilla de
  // confirmación: reescribir "sale" como "si" la dejaba ilegible.
  it("no reescribe 'sale' dentro de la fecha que se le repite al cliente", () => {
    expect(normalizeDateText("el sábado que sale mejor")).toBe(
      "el sábado que sale mejor",
    );
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

describe("parseCantidad (T-21)", () => {
  it("reconoce un dígito suelto o acompañado", () => {
    expect(parseCantidad("2")).toBe(2);
    expect(parseCantidad("dame 3")).toBe(3);
    expect(parseCantidad("quiero 12 unidades")).toBe(12);
  });

  it("reconoce las palabras número de uso común", () => {
    expect(parseCantidad("una")).toBe(1);
    expect(parseCantidad("quiero dos")).toBe(2);
    expect(parseCantidad("cinco por favor")).toBe(5);
  });

  it("prioriza el dígito sobre la palabra si aparecen los dos", () => {
    expect(parseCantidad("quiero 2 o tres")).toBe(2);
  });

  it("devuelve undefined si no hay ninguna cantidad reconocible", () => {
    expect(parseCantidad("no sé cuántas")).toBeUndefined();
    expect(parseCantidad("¿me repites las opciones?")).toBeUndefined();
    expect(parseCantidad("")).toBeUndefined();
  });

  it("no acepta cero ni negativos", () => {
    expect(parseCantidad("0")).toBeUndefined();
  });
});

describe("looksLikeDone (T-21)", () => {
  it("reconoce que el cliente ya terminó de agregar productos", () => {
    expect(looksLikeDone("no")).toBe(true);
    expect(looksLikeDone("nada más, gracias")).toBe(true);
    expect(looksLikeDone("eso es todo")).toBe(true);
    expect(looksLikeDone("ya está")).toBe(true);
  });

  it("no confunde el nombre de un producto o una respuesta normal con 'terminé'", () => {
    expect(looksLikeDone("una harina más")).toBe(false);
    expect(looksLikeDone("Carlos")).toBe(false);
  });
});
