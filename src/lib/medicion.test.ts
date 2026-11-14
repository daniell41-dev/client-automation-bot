import { describe, expect, it } from "vitest";
import {
  CLAVE_DECISION,
  clarityIdValido,
  eventoWhatsApp,
  guardarDecision,
  leerDecision,
  urlScriptClarity,
} from "@/lib/medicion";

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k: string) => datos[k] ?? null,
    setItem: (k: string, v: string) => {
      datos[k] = v;
    },
  };
}

const roto = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("decisión del visitante", () => {
  it("sin nada guardado no hay decisión (se muestra el aviso)", () => {
    expect(leerDecision(almacenFalso())).toBeNull();
    expect(leerDecision(null)).toBeNull();
  });

  it("guarda y lee aceptado / rechazado", () => {
    const a = almacenFalso();
    guardarDecision(a, "aceptado");
    expect(a.datos[CLAVE_DECISION]).toBe("aceptado");
    expect(leerDecision(a)).toBe("aceptado");
    guardarDecision(a, "rechazado");
    expect(leerDecision(a)).toBe("rechazado");
  });

  it("un valor raro no cuenta como aceptado", () => {
    expect(leerDecision(almacenFalso({ [CLAVE_DECISION]: "true" }))).toBeNull();
  });

  it("si localStorage lanza, no revienta y no asume que sí", () => {
    expect(leerDecision(roto)).toBeNull();
    expect(() => guardarDecision(roto, "aceptado")).not.toThrow();
  });
});

describe("ID de Clarity", () => {
  it("acepta letras y números", () => {
    expect(clarityIdValido(" abc123xyz ")).toBe("abc123xyz");
  });

  it("rechaza vacío, URLs o texto con espacios", () => {
    expect(clarityIdValido(undefined)).toBeNull();
    expect(clarityIdValido("")).toBeNull();
    expect(clarityIdValido("https://evil.test/x")).toBeNull();
    expect(clarityIdValido("abc 123")).toBeNull();
  });

  it("arma la URL oficial del script y el nombre del evento", () => {
    expect(urlScriptClarity("abc123xyz")).toBe("https://www.clarity.ms/tag/abc123xyz");
    expect(eventoWhatsApp("hero")).toBe("whatsapp_hero");
  });
});
