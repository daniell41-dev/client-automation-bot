import { describe, expect, it } from "vitest";
import { ABBREVIATIONS, expandChatSpanish } from "@/core/engine/chat-spanish";

describe("expandChatSpanish", () => {
  it("expande abreviaturas comunes de conectores/muletillas", () => {
    expect(expandChatSpanish("k pasa si")).toBe("que pasa si");
    expect(expandChatSpanish("q te parece")).toBe("que te parece");
    expect(expandChatSpanish("xq no")).toBe("porque no");
    expect(expandChatSpanish("dale xfa")).toBe("dale por favor");
  });

  it("expande saludos abreviados y otras abreviaturas en la misma frase", () => {
    expect(expandChatSpanish("hla, kiero info d unas")).toBe(
      "hola , quiero info de unas",
    );
    expect(expandChatSpanish("wenas")).toBe("hola");
  });

  it("expande referencias de tiempo abreviadas y preserva la ñ del reemplazo", () => {
    expect(expandChatSpanish("mnn a las 3")).toBe("mañana a las 3");
    expect(expandChatSpanish("manana a las 3")).toBe("mañana a las 3");
    expect(expandChatSpanish("hy")).toBe("hoy");
  });

  it("deja intactas las palabras que no son abreviaturas (con sus tildes)", () => {
    expect(expandChatSpanish("el sábado en la tarde")).toBe(
      "el sábado en la tarde",
    );
    expect(expandChatSpanish("Uñas")).toBe("Uñas");
  });

  it("no reemplaza dentro de otra palabra (solo tokens completos)", () => {
    expect(expandChatSpanish("hoy")).toBe("hoy"); // "y" no debe activar nada
    expect(expandChatSpanish("de")).toBe("de"); // "d" no debe activar dentro de "de"
    expect(expandChatSpanish("llamar")).toBe("llamar");
  });

  it("colapsa letras repetidas 3+ veces", () => {
    expect(expandChatSpanish("holaaa")).toBe("hola");
    expect(expandChatSpanish("siiii")).toBe("si");
    expect(expandChatSpanish("porfaaaa")).toBe("por favor");
  });

  it("separa signos de puntuación pegados a la palabra", () => {
    expect(expandChatSpanish("hola?")).toBe("hola ?");
    expect(expandChatSpanish("listo!")).toBe("listo !");
  });

  // Regresión: "sale"/"simon"/"sisas" vivían acá como sinónimos de "sí". Este
  // diccionario reescribe el texto entero, y `normalizeDateText` lo usa para
  // la fecha que el bot le REPITE al cliente — con "sale" adentro, "el sábado
  // que sale mejor" volvía como "el sábado que si mejor".
  it("no reescribe sinónimos de confirmación que también son verbos", () => {
    expect(expandChatSpanish("cuanto sale")).toBe("cuanto sale");
    expect(expandChatSpanish("el sábado que sale mejor")).toBe(
      "el sábado que sale mejor",
    );
    expect(expandChatSpanish("simon")).toBe("simon");
    expect(expandChatSpanish("sisas")).toBe("sisas");
  });

  it("el diccionario está compuesto solo por claves 'dobladas' (sin tildes)", () => {
    for (const key of Object.keys(ABBREVIATIONS)) {
      expect(key).toBe(key.toLowerCase());
      expect(key.normalize("NFD")).toBe(key); // sin diacríticos que quitar
    }
  });
});

// T-88: "p. m." se partía en "p . m ." y la "m" suelta se expandía a "me":
// el cliente escribía "hoy a las 5 p. m." y el bot le confirmaba la cita
// "para hoy a las 5 p . me".
describe("a. m. / p. m. (T-88)", () => {
  it("las abreviaturas de la hora quedan como am/pm, nunca como «me»", () => {
    expect(expandChatSpanish("hoy a las 5 p. m.")).toBe("hoy a las 5 pm");
    expect(expandChatSpanish("a las 9 a.m. por favor")).toBe("a las 9 am por favor");
    expect(expandChatSpanish("5 P.M")).toBe("5 pm");
    expect(expandChatSpanish("hoy a las 5 p. m.")).not.toMatch(/\bme\b/);
  });

  it("la «m» suelta de chat sigue siendo «me», y no se come palabras que empiezan con m", () => {
    expect(expandChatSpanish("m llamas?")).toBe("me llamas ?");
    expect(expandChatSpanish("nos vemos a. mañana")).toContain("mañana");
  });
});
