import { describe, expect, it } from "vitest";
import {
  inicioDelDia,
  procesarResumenDiario,
  textoResumenDiario,
  tocaResumenDiario,
  ventasDelDia,
  type PedidoVenta,
} from "@/core/engine/ventas-del-dia";
import type { BusinessConfig } from "@/core/types";

// 4:00 p. m. en Bogotá (UTC-5) del miércoles 25 de noviembre.
const ahora = new Date("2026-11-25T21:00:00.000Z");

function pedido(cambios: Partial<PedidoVenta>): PedidoVenta {
  return {
    estado: "aprobado",
    total: 20000,
    moneda: "COP",
    created_at: "2026-11-25T17:00:00.000Z",
    items: [{ nombre: "Bandeja paisa", cantidad: 1 }],
    ...cambios,
  };
}

describe("inicioDelDia", () => {
  it("es la medianoche de Colombia, no la del servidor (UTC)", () => {
    expect(inicioDelDia(ahora, "America/Bogota").toISOString()).toBe("2026-11-25T05:00:00.000Z");
    // 9 p. m. en Bogotá ya es el día siguiente en UTC: sigue siendo el 25 en Colombia.
    expect(inicioDelDia(new Date("2026-11-26T02:00:00.000Z"), "America/Bogota").toISOString()).toBe(
      "2026-11-25T05:00:00.000Z",
    );
  });
});

describe("ventasDelDia", () => {
  const desde = inicioDelDia(ahora, "America/Bogota");

  it("solo cuenta como vendido lo aprobado, listo o entregado; lo que espera respuesta va aparte", () => {
    const v = ventasDelDia(
      [
        pedido({ estado: "aprobado", total: 20000 }),
        pedido({ estado: "entregado", total: 15000 }),
        pedido({ estado: "listo", total: 5000 }),
        pedido({ estado: "por_verificar", total: 99000 }),
        pedido({ estado: "esperando_pago", total: 99000 }),
        pedido({ estado: "rechazado", total: 99000 }),
        pedido({ estado: "vencido", total: 99000 }),
        // De ayer en Colombia (11 p. m. del 24 = 04:00 UTC del 25): no cuenta.
        pedido({ estado: "aprobado", total: 99000, created_at: "2026-11-25T04:00:00.000Z" }),
      ],
      desde,
    );
    expect(v).toMatchObject({ vendidos: 3, total: 40000, moneda: "COP", porAprobar: 2 });
  });

  it("dice lo más pedido sumando cantidades", () => {
    const v = ventasDelDia(
      [
        pedido({ items: [{ nombre: "Limonada", cantidad: 3 }, { nombre: "Bandeja paisa", cantidad: 1 }] }),
        pedido({ items: [{ nombre: "Bandeja paisa", cantidad: 1 }] }),
      ],
      desde,
    );
    expect(v.masPedido).toEqual({ nombre: "Limonada", cantidad: 3 });
  });

  it("con pedidos en dos monedas no inventa una suma", () => {
    const v = ventasDelDia([pedido({}), pedido({ moneda: "USD", total: 10 })], desde);
    expect(v.total).toBeNull();
    expect(v.vendidos).toBe(2);
  });
});

describe("textoResumenDiario", () => {
  it("arma el mensaje para la dueña", () => {
    const texto = textoResumenDiario("Sabores del Sur", {
      vendidos: 5,
      total: 180000,
      moneda: "COP",
      porAprobar: 1,
      masPedido: { nombre: "Bandeja paisa", cantidad: 4 },
    });
    expect(texto).toContain("Sabores del Sur");
    expect(texto).toContain("5 pedidos");
    expect(texto).toMatch(/\$\s?180\.000/);
    expect(texto).toContain("Bandeja paisa (4)");
    expect(texto).toContain("1 pedido espera su respuesta");
  });
});

describe("tocaResumenDiario", () => {
  const config = {
    timezone: "America/Bogota",
    resumenDiario: { activo: true },
    horarios: [3].map((dow) => ({ dow, abierto: true, tramos: [{ desde: "11:00", hasta: "15:00" }] })),
  } as unknown as BusinessConfig;
  const a = (horaUtc: string) => new Date(`2026-11-25T${horaUtc}:00.000Z`);

  it("sale después del cierre del día (y no antes), hasta 3 horas después", () => {
    expect(tocaResumenDiario(config, a("19:50"))).toBe(false); // 2:50 p. m.
    expect(tocaResumenDiario(config, a("20:05"))).toBe(true); // 3:05 p. m.
    expect(tocaResumenDiario(config, a("23:30"))).toBe(false); // 6:30 p. m.
  });

  it("sin horarios, a las 9 p. m.", () => {
    const sinHorarios = { ...config, horarios: undefined } as BusinessConfig;
    expect(tocaResumenDiario(sinHorarios, new Date("2026-11-26T01:30:00.000Z"))).toBe(false); // 8:30 p. m.
    expect(tocaResumenDiario(sinHorarios, new Date("2026-11-26T02:10:00.000Z"))).toBe(true); // 9:10 p. m.
  });

  it("apagado, nunca", () => {
    expect(tocaResumenDiario({ ...config, resumenDiario: { activo: false } } as BusinessConfig, a("20:05"))).toBe(false);
  });
});

describe("procesarResumenDiario", () => {
  const config = {
    name: "Sabores",
    timezone: "America/Bogota",
    notifyPhoneNumber: "573001112233",
    resumenDiario: { activo: true },
  } as unknown as BusinessConfig;
  const nueve = new Date("2026-11-26T02:10:00.000Z"); // 9:10 p. m. del 25 en Bogotá

  function deps(pedidos: PedidoVenta[], yaEnviado = false) {
    const enviados: string[] = [];
    const reclamados: string[] = [];
    return {
      enviados,
      reclamados,
      d: {
        reclamar: async (fecha: string) => {
          reclamados.push(fecha);
          return !yaEnviado;
        },
        pedidosDesde: async () => pedidos,
        enviar: async (t: string) => {
          enviados.push(t);
        },
      },
    };
  }

  it("a la hora del cierre, reclama el día local y manda el resumen", async () => {
    const x = deps([pedido({ created_at: "2026-11-25T23:00:00.000Z" })]);
    expect(await procesarResumenDiario(config, nueve, x.d)).toBe(true);
    expect(x.reclamados).toEqual(["2026-11-25"]);
    expect(x.enviados[0]).toContain("Vendió");
  });

  it("si otro proceso ya lo mandó hoy, no se repite", async () => {
    const x = deps([pedido({ created_at: "2026-11-25T23:00:00.000Z" })], true);
    expect(await procesarResumenDiario(config, nueve, x.d)).toBe(false);
    expect(x.enviados).toEqual([]);
  });

  it("un día sin pedidos no manda nada (ni reclama el día)", async () => {
    const x = deps([]);
    expect(await procesarResumenDiario(config, nueve, x.d)).toBe(false);
    expect(x.reclamados).toEqual([]);
  });

  it("sin número de Notificaciones no hace nada", async () => {
    const x = deps([pedido({ created_at: "2026-11-25T23:00:00.000Z" })]);
    expect(await procesarResumenDiario({ ...config, notifyPhoneNumber: undefined } as BusinessConfig, nueve, x.d)).toBe(false);
  });
});
