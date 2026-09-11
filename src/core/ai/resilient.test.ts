import { describe, expect, it } from "vitest";
import { ResilientProvider } from "@/core/ai/resilient";
import type { ILLMProvider, LLMContext } from "@/core/ai/provider";

const ctx: LLMContext = {
  businessName: "Estética Bella",
  persona: { name: "Isabella", tone: "cálida", language: "español colombiano" },
  history: [],
  draftResponse: "borrador original",
  stage: "info_enviada",
};

/** Provider falso: siempre lanza. */
function failingProvider(model: string): ILLMProvider {
  return {
    model,
    async enhance() {
      throw new Error(`${model} caído`);
    },
    async extractDateTime() {
      throw new Error(`${model} caído`);
    },
    async interpret() {
      throw new Error(`${model} caído`);
    },
    async runAgent() {
      throw new Error(`${model} caído`);
    },
  };
}

/** Provider falso: siempre responde. */
function workingProvider(
  model: string,
  text: string,
  date: string | null,
  interpreted: string | null = null,
): ILLMProvider {
  return {
    model,
    async enhance() {
      return text;
    },
    async extractDateTime() {
      return date;
    },
    async interpret() {
      return interpreted;
    },
    async runAgent() {
      return null;
    },
  };
}

describe("ResilientProvider — enhance", () => {
  it("usa el primer proveedor si funciona, sin tocar el segundo", async () => {
    let secondCalled = false;
    const second: ILLMProvider = {
      model: "second",
      async enhance() {
        secondCalled = true;
        return "no debería llegar acá";
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent() {
        return null;
      },
    };
    const chain = new ResilientProvider([
      workingProvider("primero", "respuesta del primero", null),
      second,
    ]);
    const result = await chain.enhance(ctx);
    expect(result).toBe("respuesta del primero");
    expect(secondCalled).toBe(false);
  });

  it("cae al segundo proveedor si el primero falla", async () => {
    const chain = new ResilientProvider([
      failingProvider("primero"),
      workingProvider("segundo", "respuesta del segundo", null),
    ]);
    expect(await chain.enhance(ctx)).toBe("respuesta del segundo");
  });

  it("si TODOS fallan, devuelve el borrador del motor (no rompe la conversación)", async () => {
    const chain = new ResilientProvider([failingProvider("uno"), failingProvider("dos")]);
    expect(await chain.enhance(ctx)).toBe("borrador original");
  });
});

describe("ResilientProvider — extractDateTime", () => {
  const input = { text: "mañana", nowISO: "2026-06-29T10:00:00.000Z", timezone: "America/Bogota" };

  it("un null del PRIMER proveedor (fecha ambigua) NO dispara el fallback", async () => {
    let secondCalled = false;
    const second: ILLMProvider = {
      model: "second",
      async enhance() {
        return "";
      },
      async extractDateTime() {
        secondCalled = true;
        return "2026-06-30T15:00:00-05:00";
      },
      async interpret() {
        return null;
      },
      async runAgent() {
        return null;
      },
    };
    const chain = new ResilientProvider([
      workingProvider("primero", "", null), // responde null, no lanza
      second,
    ]);
    const result = await chain.extractDateTime(input);
    expect(result).toBeNull();
    expect(secondCalled).toBe(false);
  });

  it("si el primero LANZA (no null, un error real), pasa al segundo", async () => {
    const chain = new ResilientProvider([
      failingProvider("primero"),
      workingProvider("segundo", "", "2026-06-30T15:00:00-05:00"),
    ]);
    expect(await chain.extractDateTime(input)).toBe("2026-06-30T15:00:00-05:00");
  });

  it("si todos fallan (lanzan), devuelve null", async () => {
    const chain = new ResilientProvider([failingProvider("uno"), failingProvider("dos")]);
    expect(await chain.extractDateTime(input)).toBeNull();
  });
});

describe("ResilientProvider — model descriptivo", () => {
  it("combina los nombres de los proveedores en orden", () => {
    const chain = new ResilientProvider([
      workingProvider("gemini-2.5-flash-lite", "", null),
      workingProvider("llama-3.1-8b-instant", "", null),
    ]);
    expect(chain.model).toBe("gemini-2.5-flash-lite (+llama-3.1-8b-instant)");
  });

  it("con un solo proveedor no agrega paréntesis", () => {
    const chain = new ResilientProvider([workingProvider("solo-uno", "", null)]);
    expect(chain.model).toBe("solo-uno");
  });

  it("lanza si se construye sin proveedores", () => {
    expect(() => new ResilientProvider([])).toThrow();
  });
});

describe("ResilientProvider — interpret", () => {
  const input = {
    text: "me interesa lo de las manos",
    options: ["Limpieza facial", "Uñas"],
    stage: "menu_enviado",
    history: [],
  };

  it("usa la interpretación del primer proveedor que responda (sin lanzar)", async () => {
    const chain = new ResilientProvider([
      workingProvider("primero", "", null, "Uñas"),
      workingProvider("segundo", "", null, "Limpieza facial"),
    ]);
    expect(await chain.interpret(input)).toBe("Uñas");
  });

  it("un null del primer proveedor (no reconoce nada) NO dispara el fallback", async () => {
    let secondCalled = false;
    const second: ILLMProvider = {
      model: "segundo",
      async enhance() {
        return "";
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        secondCalled = true;
        return "Uñas";
      },
      async runAgent() {
        return null;
      },
    };
    const chain = new ResilientProvider([workingProvider("primero", "", null, null), second]);
    expect(await chain.interpret(input)).toBeNull();
    expect(secondCalled).toBe(false);
  });

  it("si el primero LANZA, pasa al segundo", async () => {
    const chain = new ResilientProvider([
      failingProvider("primero"),
      workingProvider("segundo", "", null, "Uñas"),
    ]);
    expect(await chain.interpret(input)).toBe("Uñas");
  });

  it("si todos fallan (lanzan), devuelve null", async () => {
    const chain = new ResilientProvider([failingProvider("uno"), failingProvider("dos")]);
    expect(await chain.interpret(input)).toBeNull();
  });
});
