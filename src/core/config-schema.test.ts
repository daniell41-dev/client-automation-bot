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

describe("parseBusinessConfig — pagos (T-24.4)", () => {
  it("acepta pagos.requiereComprobante + telefonoDestino", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      pagos: { requiereComprobante: true, telefonoDestino: "3001112233" },
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed?.pagos).toEqual({ requiereComprobante: true, telefonoDestino: "3001112233" });
  });

  it("sin pagos la config sigue siendo válida (opcional, no cambia el comportamiento de antes de T-24)", () => {
    const parsed = parseBusinessConfig(JSON.parse(JSON.stringify(esteticaBella)));
    expect(parsed?.pagos).toBeUndefined();
  });

  it("messages.pedirComprobante es opcional", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      messages: { ...esteticaBella.messages, pedirComprobante: "Pagá y mandanos el comprobante 📸" },
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed?.messages.pedirComprobante).toBe("Pagá y mandanos el comprobante 📸");
  });
});

describe("parseBusinessConfig — pagos.wompi (T-24.5)", () => {
  it("acepta pagos.wompi.enabled + redirectUrl — nunca llaves secretas acá", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      pagos: { wompi: { enabled: true, redirectUrl: "https://ejemplo.com/gracias" } },
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed?.pagos?.wompi).toEqual({ enabled: true, redirectUrl: "https://ejemplo.com/gracias" });
  });

  it("sin pagos.wompi la config sigue siendo válida (opcional)", () => {
    const parsed = parseBusinessConfig(JSON.parse(JSON.stringify(esteticaBella)));
    expect(parsed?.pagos?.wompi).toBeUndefined();
  });

  it("una llave secreta de Wompi metida por error en pagos.wompi se descarta en silencio (Zod no la declara)", () => {
    // No es un test de que "funcione" tenerla ahí — es la prueba de que ESTE
    // campo nunca puede colarse hacia negocios.config, ni por accidente: Zod
    // descarta claves desconocidas (sin .passthrough()), así que aunque
    // alguien la escriba a mano, parseBusinessConfig la tira.
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      pagos: { wompi: { enabled: true, integritySecret: "no-debería-guardarse" } },
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed?.pagos?.wompi).toEqual({ enabled: true });
    expect((parsed?.pagos?.wompi as Record<string, unknown> | undefined)?.integritySecret).toBeUndefined();
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

describe("parseBusinessConfig — catálogo por rubro (T-21)", () => {
  /** Config mínima de una tienda: productos sin duración. */
  function tienda(overrides: Record<string, unknown> = {}) {
    return {
      slug: "tienda-test",
      name: "Tienda",
      currency: "COP",
      services: [
        {
          id: "harina-pan",
          name: "Harina 1 Kg",
          description: "Harina pan tradicional de Venezuela",
          price: 5000,
          keywords: ["harina"],
        },
      ],
      messages: {
        welcome: "h",
        askName: "n",
        askDate: "f",
        askConfirm: "c",
        serviceInfo: "i",
        captured: "k",
        fallback: "x",
      },
      followUps: [],
      ...overrides,
    };
  }

  it("acepta un producto SIN duración — antes de T-21 esto tumbaba la plantilla entera", () => {
    // Este es el caso exacto que dejaba a un rubro de tienda sin poder
    // guardarse: `durationMinutes` era `positive()`, así que ni faltando ni
    // en 0 pasaba, y `crearNegocio` respondía "la plantilla es inválida".
    expect(parseBusinessConfig(tienda())).not.toBeNull();
  });

  it("sigue rechazando duración 0 cuando el campo viene (0 no es una duración)", () => {
    const conCero = tienda({
      services: [{ id: "x", name: "X", description: "", price: 100, durationMinutes: 0 }],
    });
    expect(parseBusinessConfig(conCero)).toBeNull();
  });

  it("un ítem que se reserva SIGUE necesitando duración", () => {
    const sinDuracion = tienda({
      services: [{ id: "x", name: "X", description: "", price: 100, reservable: true }],
    });
    expect(parseBusinessConfig(sinDuracion)).toBeNull();
  });

  it("un ítem con modo 'cita' explícito también la necesita", () => {
    const sinDuracion = tienda({
      services: [{ id: "x", name: "X", description: "", price: 100, modo: "cita" }],
    });
    expect(parseBusinessConfig(sinDuracion)).toBeNull();
  });

  it("un ítem con modo 'pedido' no la necesita, aunque esté marcado reservable", () => {
    const producto = tienda({
      services: [
        { id: "x", name: "X", description: "", price: 100, modo: "pedido", reservable: true },
      ],
    });
    expect(parseBusinessConfig(producto)).not.toBeNull();
  });

  it("conserva el bloque `catalogo` — si no estuviera en el schema, Zod lo descartaría en silencio", () => {
    // La regresión que esto protege es muda: sin la clave declarada, el
    // bloque se pierde entre la plantilla del rubro y el config del negocio
    // y el bot vuelve a comportarse como si todo fuera una cita.
    const conCatalogo = tienda({
      catalogo: {
        etiqueta: { singular: "Producto", plural: "Productos" },
        modoPorDefecto: "pedido",
        campos: { duracion: false, stock: true, categoria: true },
      },
    });
    const parsed = parseBusinessConfig(conCatalogo);
    expect(parsed?.catalogo?.modoPorDefecto).toBe("pedido");
    expect(parsed?.catalogo?.etiqueta?.singular).toBe("Producto");
    expect(parsed?.catalogo?.campos?.stock).toBe(true);
  });

  it("acepta stock en un producto y rechaza uno negativo", () => {
    const conStock = tienda({
      services: [{ id: "x", name: "X", description: "", price: 100, stock: 12 }],
    });
    expect(parseBusinessConfig(conStock)?.services[0].stock).toBe(12);

    const negativo = tienda({
      services: [{ id: "x", name: "X", description: "", price: 100, stock: -1 }],
    });
    expect(parseBusinessConfig(negativo)).toBeNull();
  });

  it("estética sigue validando igual que antes (no cambió nada para el rubro que ya funciona)", () => {
    const parsed = parseBusinessConfig(JSON.parse(JSON.stringify(esteticaBella)));
    expect(parsed).not.toBeNull();
    expect(parsed?.services.every((s) => s.durationMinutes! > 0)).toBe(true);
    expect(parsed?.catalogo).toBeUndefined();
  });
});
