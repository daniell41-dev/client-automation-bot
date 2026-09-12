import { describe, expect, it } from "vitest";
import { parseBusinessConfig, personaSchema, serviceSchema, servicesSchema } from "@/core/config-schema";
import { esteticaBella } from "@/businesses/estetica-bella/config";

describe("parseBusinessConfig", () => {
  it("acepta la config real de estética bella (round-trip por JSON)", () => {
    const parsed = parseBusinessConfig(JSON.parse(JSON.stringify(esteticaBella)));
    expect(parsed).not.toBeNull();
    expect(parsed?.slug).toBe("estetica-bella");
    expect(parsed?.services.length).toBeGreaterThan(0);
    expect(parsed?.personas?.whatsapp?.name).toBe("Isabella");
  });

  it("rechaza una config sin servicios", () => {
    const invalida = { ...JSON.parse(JSON.stringify(esteticaBella)), services: [] };
    expect(parseBusinessConfig(invalida)).toBeNull();
  });

  it("rechaza un slug que no es kebab-case", () => {
    const invalida = { ...JSON.parse(JSON.stringify(esteticaBella)), slug: "Mi Negocio!" };
    expect(parseBusinessConfig(invalida)).toBeNull();
  });

  it("rechaza mensajes incompletos (falta askConfirm)", () => {
    const base = JSON.parse(JSON.stringify(esteticaBella));
    delete base.messages.askConfirm;
    expect(parseBusinessConfig(base)).toBeNull();
  });

  it("rechaza cosas que no son objetos", () => {
    expect(parseBusinessConfig(null)).toBeNull();
    expect(parseBusinessConfig("texto")).toBeNull();
    expect(parseBusinessConfig(42)).toBeNull();
  });
});

describe("parseBusinessConfig — horarios (T-20)", () => {
  it("acepta horarios en el formato nuevo (dow + tramos)", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      horarios: [
        { dow: 1, abierto: true, tramos: [{ desde: "09:00", hasta: "13:00" }, { desde: "15:00", hasta: "19:00" }] },
      ],
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed?.horarios).toHaveLength(1);
    expect(parsed?.horarios?.[0].tramos).toHaveLength(2);
  });

  it("sin horarios: la config sigue siendo válida (campo opcional)", () => {
    const base = JSON.parse(JSON.stringify(esteticaBella));
    delete base.horarios;
    const parsed = parseBusinessConfig(base);
    expect(parsed).not.toBeNull();
    expect(parsed?.horarios).toBeUndefined();
  });

  it("degrada a undefined (NO invalida toda la config) con el formato viejo de texto libre", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      horarios: [{ dia: "Lunes a viernes", desde: "09:00", hasta: "19:00", abierto: true }],
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed).not.toBeNull(); // el negocio entero no se cae al registry estático
    expect(parsed?.horarios).toBeUndefined(); // pero sin horarios válidos no se valida nada
  });

  it("degrada a undefined con una hora mal formada", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      horarios: [{ dow: 1, abierto: true, tramos: [{ desde: "9am", hasta: "19:00" }] }],
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed).not.toBeNull();
    expect(parsed?.horarios).toBeUndefined();
  });

  it("degrada a undefined con un dow fuera de rango", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      horarios: [{ dow: 9, abierto: true, tramos: [] }],
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed).not.toBeNull();
    expect(parsed?.horarios).toBeUndefined();
  });
});

describe("parseBusinessConfig — pedidos y notifyPhoneNumber", () => {
  it("acepta pedidos válido (enabled + pregunta + 2-4 opciones)", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      pedidos: {
        enabled: true,
        pregunta: "¿Retirás o comés acá?",
        opciones: ["Retirar", "Comer aquí"],
      },
      notifyPhoneNumber: "573001234567",
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed?.pedidos?.opciones).toEqual(["Retirar", "Comer aquí"]);
    expect(parsed?.notifyPhoneNumber).toBe("573001234567");
  });

  it("rechaza pedidos con menos de 2 opciones", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      pedidos: { enabled: true, pregunta: "¿Y?", opciones: ["Solo una"] },
    };
    expect(parseBusinessConfig(config)).toBeNull();
  });

  it("sin pedidos ni notifyPhoneNumber la config sigue siendo válida (opcionales)", () => {
    const parsed = parseBusinessConfig(JSON.parse(JSON.stringify(esteticaBella)));
    expect(parsed?.pedidos).toBeUndefined();
    expect(parsed?.notifyPhoneNumber).toBeUndefined();
  });
});

/**
 * T-12: estos sub-schemas se exportan para que los editores del portal
 * (Catálogo, Configuración) validen en el CLIENTE con el mismo objeto Zod
 * que corre acá adentro de `businessConfigSchema` — nunca una copia que se
 * pueda desalinear.
 */
describe("serviceSchema / servicesSchema (exportados para el editor de Catálogo)", () => {
  const base = {
    id: "unas",
    name: "Uñas",
    description: "Manicura completa",
    price: 15000,
    durationMinutes: 45,
  };

  it("acepta un servicio válido", () => {
    expect(serviceSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza un nombre vacío, con el mensaje que el editor muestra", () => {
    const result = serviceSchema.safeParse({ ...base, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El nombre es obligatorio.");
      expect(result.error.issues[0].path).toEqual(["name"]);
    }
  });

  it("rechaza un precio negativo", () => {
    const result = serviceSchema.safeParse({ ...base, price: -100 });
    expect(result.success).toBe(false);
  });

  it("servicesSchema rechaza un catálogo vacío", () => {
    expect(servicesSchema.safeParse([]).success).toBe(false);
  });

  it("servicesSchema ubica el error en el índice del ítem que falla (no en el primero)", () => {
    const result = servicesSchema.safeParse([base, { ...base, id: "otro", name: "" }]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe(1);
      expect(result.error.issues[0].path[1]).toBe("name");
    }
  });
});

describe("personaSchema (exportado para el editor de Configuración)", () => {
  it("acepta una persona válida", () => {
    expect(
      personaSchema.safeParse({ name: "Isabella", tone: "cálida", language: "es" }).success,
    ).toBe(true);
  });

  it("rechaza el nombre del bot vacío, con el mensaje que el editor muestra", () => {
    const result = personaSchema.safeParse({ name: "", tone: "cálida", language: "es" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El nombre del bot es obligatorio.");
    }
  });
});
