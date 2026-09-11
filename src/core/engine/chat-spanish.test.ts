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

  it("el diccionario está compuesto solo por claves 'dobladas' (sin tildes)", () => {
    for (const key of Object.keys(ABBREVIATIONS)) {
      expect(key).toBe(key.toLowerCase());
      expect(key.normalize("NFD")).toBe(key); // sin diacríticos que quitar
    }
  });
});
