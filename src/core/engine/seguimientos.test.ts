import { describe, expect, it } from "vitest";
import { decidirSeguimiento, esBuenaHora, pideNoContactar, textoDePrueba } from "@/core/engine/seguimientos";
import type { BusinessConfig, Lead } from "@/core/types";

const config = {
  slug: "jeans",
  name: "Jeans",
  currency: "COP",
  timezone: "America/Bogota",
  services: [
    {
      id: "jean",
      name: "Jean clásico",
      description: "",
      price: 35000,
      referencia: "102",
      variantes: { nombre: "Talla", opciones: ["30", "32"] },
    },
    { id: "correa", name: "Correa", description: "", price: 15000 },
  ],
  seguimientos: { activo: true },
} as unknown as BusinessConfig;

// 10:00 a. m. en Bogotá (UTC-5) de un domingo.
const ultimo = new Date("2026-11-22T15:00:00.000Z");
const masTarde = (horas: number) => new Date(ultimo.getTime() + horas * 3600_000);

function lead(cambios: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    businessSlug: "jeans",
    channel: "whatsapp",
    contact: "573000000001",
    name: "Carlos Pérez",
    state: "interesado",
    stage: "carrito_abierto",
    serviceId: "jean",
    items: [
      { serviceId: "jean", cantidad: 6, variante: "30" },
      { serviceId: "correa", cantidad: 1 },
    ],
    followUpsSent: [],
    createdAt: ultimo.toISOString(),
    updatedAt: ultimo.toISOString(),
    lastInboundAt: ultimo.toISOString(),
    ...cambios,
  } as Lead;
}

describe("T-106: cuándo se escribe", () => {
  it("a las 2 h, retomando el pedido con su nombre y lo que dejó en el carrito", () => {
    const s = decidirSeguimiento(lead(), config, masTarde(2.1));
    expect(s?.umbral).toBe("2h");
    expect(s?.texto).toBe(
      "Hola Carlos 👋 ¿Seguimos con su pedido de 6 Jean clásico Ref 102 · Talla 30 y 1 Correa? Si quiere, se lo dejo listo 🙌",
    );
  });

  it("antes de las 2 h, nada", () => {
    expect(decidirSeguimiento(lead(), config, masTarde(1.5))).toBeNull();
  });

  it("el segundo a las 20 h, y nunca un tercero", () => {
    // 20 h después de las 10 a. m. son las 6 a. m.: se espera a las 8 a. m. (22 h).
    expect(decidirSeguimiento(lead({ followUpsSent: ["2h"] }), config, masTarde(20.5))).toBeNull();
    const despues = masTarde(22.2); // 8:12 a. m. del lunes en Bogotá
    expect(decidirSeguimiento(lead({ followUpsSent: ["2h"] }), config, despues)?.umbral).toBe("20h");
    expect(decidirSeguimiento(lead({ followUpsSent: ["2h", "20h"] }), config, despues)).toBeNull();
  });

  it("si el cron se atrasó y vencieron los dos, sale solo uno y quedan marcados los dos", () => {
    const s = decidirSeguimiento(lead(), config, masTarde(22.5));
    expect(s?.umbral).toBe("20h");
    expect(s?.marcar).toEqual(["2h", "20h"]);
  });

  it("pasadas las 23 h y media (fuera de la ventana gratis de WhatsApp), nada", () => {
    expect(decidirSeguimiento(lead({ followUpsSent: ["2h"] }), config, masTarde(23.6))).toBeNull();
  });
});

describe("T-106: a quién NO se le escribe", () => {
  it("si el negocio no lo encendió", () => {
    const apagado = { ...config, seguimientos: undefined } as BusinessConfig;
    expect(decidirSeguimiento(lead(), apagado, masTarde(3))).toBeNull();
  });

  it("si pidió que no le escriban", () => {
    expect(decidirSeguimiento(lead({ noContactar: true }), config, masTarde(3))).toBeNull();
  });

  it("si ya compró, si espera a la dueña o si solo saludó", () => {
    expect(decidirSeguimiento(lead({ stage: "datos_completos" }), config, masTarde(3))).toBeNull();
    expect(decidirSeguimiento(lead({ stage: "esperando_aprobacion" }), config, masTarde(3))).toBeNull();
    expect(
      decidirSeguimiento(lead({ stage: "menu_enviado", items: undefined, serviceId: undefined }), config, masTarde(3)),
    ).toBeNull();
  });

  it("si el lead está cerrado (perdido o ya pagó)", () => {
    expect(decidirSeguimiento(lead({ state: "perdido" }), config, masTarde(3))).toBeNull();
  });
});

describe("T-106: no de noche", () => {
  it("sin horarios cargados, solo de 8 a. m. a 8 p. m. (hora de Bogotá)", () => {
    // Último mensaje a las 7 p. m.: a las 2 h son las 9 p. m. → espera.
    const tarde = new Date("2026-11-23T00:00:00.000Z");
    const l = lead({ lastInboundAt: tarde.toISOString() });
    expect(decidirSeguimiento(l, config, new Date(tarde.getTime() + 2 * 3600_000))).toBeNull();
    expect(esBuenaHora(config, new Date("2026-11-22T13:30:00.000Z"))).toBe(true); // 8:30 a. m.
    expect(esBuenaHora(config, new Date("2026-11-22T12:30:00.000Z"))).toBe(false); // 7:30 a. m.
  });

  it("con horarios, solo cuando el negocio está abierto", () => {
    const conHorario = {
      ...config,
      horarios: [{ dow: 0, abierto: true, tramos: [{ desde: "11:00", hasta: "15:00" }] }],
    } as unknown as BusinessConfig;
    expect(esBuenaHora(conHorario, new Date("2026-11-22T17:00:00.000Z"))).toBe(true); // domingo 12 m
    expect(esBuenaHora(conHorario, new Date("2026-11-22T21:00:00.000Z"))).toBe(false); // domingo 4 p. m.
    expect(esBuenaHora(conHorario, new Date("2026-11-23T17:00:00.000Z"))).toBe(false); // lunes, sin horario
  });
});

describe("T-106: textos", () => {
  it("el negocio puede escribir los suyos con {{nombre}} y {{pedido}}", () => {
    const propio = {
      ...config,
      seguimientos: { activo: true, primero: "Hola{{nombre}}, ¿le despacho {{pedido}} hoy mismo?" },
    } as BusinessConfig;
    expect(decidirSeguimiento(lead({ items: [{ serviceId: "correa", cantidad: 2 }] }), propio, masTarde(2.1))?.texto).toBe(
      "Hola Carlos, ¿le despacho 2 Correa hoy mismo?",
    );
  });

  it("sin nombre no queda un espacio suelto", () => {
    const s = decidirSeguimiento(lead({ name: undefined, items: [{ serviceId: "correa", cantidad: 1 }] }), config, masTarde(2.1));
    expect(s?.texto).toBe("Hola 👋 ¿Seguimos con su pedido de 1 Correa? Si quiere, se lo dejo listo 🙌");
  });
});

describe("T-106: pedir que no le escriban", () => {
  it("frases explícitas", () => {
    for (const t of ["No me escriban más", "no me vuelvan a escribir", "dejen de escribirme", "no quiero más mensajes", "STOP"]) {
      expect(pideNoContactar(t), t).toBe(true);
    }
  });

  it("un 'no gracias' o un pedido normal no cuentan", () => {
    for (const t of ["no gracias", "no, eso es todo", "quiero 6 jeans", "escríbame mañana"]) {
      expect(pideNoContactar(t), t).toBe(false);
    }
  });
});

describe("T-106: procesarSeguimientos", () => {
  it("manda, marca como enviado y no repite en la siguiente vuelta", async () => {
    const enviados: string[] = [];
    let guardado: Lead | undefined;
    const deps = {
      enviar: async (_l: Lead, texto: string) => {
        enviados.push(texto);
      },
      guardar: async (l: Lead) => {
        guardado = l;
      },
    };
    const { procesarSeguimientos } = await import("@/core/engine/seguimientos");
    expect(await procesarSeguimientos([lead()], config, masTarde(2.1), deps)).toBe(1);
    expect(guardado?.followUpsSent).toEqual(["2h"]);
    expect(await procesarSeguimientos([guardado!], config, masTarde(2.5), deps)).toBe(0);
    expect(enviados).toHaveLength(1);
  });

  it("si el envío falla no se marca (se reintenta) y los demás leads siguen", async () => {
    const guardados: Lead[] = [];
    const deps = {
      enviar: async (l: Lead) => {
        if (l.id === "falla") throw new Error("Meta caído");
      },
      guardar: async (l: Lead) => {
        guardados.push(l);
      },
    };
    const { procesarSeguimientos } = await import("@/core/engine/seguimientos");
    const n = await procesarSeguimientos([lead({ id: "falla" }), lead({ id: "ok" })], config, masTarde(2.1), deps);
    expect(n).toBe(1);
    expect(guardados.map((l) => l.id)).toEqual(["ok"]);
  });
});

// T-112: el botón "Enviarme una prueba" de Configuración.
describe("textoDePrueba", () => {
  it("con un pedido a medias del número de la dueña, usa su nombre y su carrito", () => {
    expect(textoDePrueba(undefined, lead(), config)).toBe(
      "Hola Carlos 👋 ¿Seguimos con su pedido de 6 Jean clásico Ref 102 · Talla 30 y 1 Correa? Si quiere, se lo dejo listo 🙌",
    );
  });

  it("sin pedido propio, arma uno de ejemplo con el primer producto", () => {
    expect(textoDePrueba("Hola{{nombre}}, ¿retomamos {{pedido}}?", null, config)).toBe(
      "Hola Carlos, ¿retomamos 2 Jean clásico Ref 102?",
    );
    // Un lead sin carrito (solo saludó) también cae al ejemplo.
    expect(textoDePrueba(undefined, lead({ items: [], serviceId: undefined, name: "Ana" }), config)).toContain(
      "2 Jean clásico Ref 102",
    );
  });

  it("un texto vacío usa el del sistema", () => {
    expect(textoDePrueba("   ", null, config)).toContain("¿Seguimos con su pedido de");
  });
});
