import { describe, expect, it } from "vitest";
import { buildImageDescriptionPrompt, parseImageDescription } from "@/core/ai/image-prompt";

describe("buildImageDescriptionPrompt", () => {
  it("instruye a describir solo lo visible, sin decidir el producto del catálogo", () => {
    const prompt = buildImageDescriptionPrompt().toLowerCase();
    expect(prompt).toMatch(/solo lo que se ve|no decidís/);
    expect(prompt).toContain("json");
  });
});

describe("parseImageDescription", () => {
  it("parsea una descripción válida", () => {
    const raw = JSON.stringify({
      tipoProducto: "aceite de cocina",
      marca: "Gourmet",
      textoVisible: ["1 LITRO", "Gourmet"],
      categoria: "abarrotes",
      esRecipeMedico: false,
      confianza: "alta",
    });
    expect(parseImageDescription(raw)).toEqual({
      tipoProducto: "aceite de cocina",
      marca: "Gourmet",
      textoVisible: ["1 LITRO", "Gourmet"],
      categoria: "abarrotes",
      esRecipeMedico: false,
      confianza: "alta",
    });
  });

  it("acepta que venga envuelta en fences de markdown", () => {
    const raw = [
      "```json",
      JSON.stringify({
        tipoProducto: "champú",
        textoVisible: [],
        esRecipeMedico: false,
        confianza: "media",
      }),
      "```",
    ].join("\n");
    const result = parseImageDescription(raw);
    expect(result?.tipoProducto).toBe("champú");
  });

  it("aplica default [] a textoVisible cuando falta", () => {
    const raw = JSON.stringify({
      tipoProducto: "champú",
      esRecipeMedico: false,
      confianza: "baja",
    });
    expect(parseImageDescription(raw)?.textoVisible).toEqual([]);
  });

  it("devuelve null si no es JSON", () => {
    expect(parseImageDescription("esto no es json")).toBeNull();
  });

  it("devuelve null si el JSON no cumple el contrato (falta esRecipeMedico)", () => {
    const raw = JSON.stringify({ tipoProducto: "x", confianza: "alta" });
    expect(parseImageDescription(raw)).toBeNull();
  });

  it("devuelve null si confianza no es uno de los tres valores válidos", () => {
    const raw = JSON.stringify({
      tipoProducto: "x",
      esRecipeMedico: false,
      confianza: "segura",
    });
    expect(parseImageDescription(raw)).toBeNull();
  });

  it("devuelve null ante una cadena vacía", () => {
    expect(parseImageDescription("")).toBeNull();
    expect(parseImageDescription("   ")).toBeNull();
  });
});
