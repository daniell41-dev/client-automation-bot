import { describe, expect, it } from "vitest";
import {
  armarPendientes,
  fechaLarga,
  pedidosDeHoy,
  saludo,
  totalVendido,
  type NegocioInicio,
  type PedidoInicio,
} from "@/lib/inicio-portal";

const parrilla: NegocioInicio = { id: "n1", slug: "la-parrilla", nombre: "La Parrilla" };
const estetica: NegocioInicio = { id: "n2", slug: "estetica-bella", nombre: "Estética Bella" };

function pedido(extra: Partial<PedidoInicio>): PedidoInicio {
  return {
    negocio_id: "n1",
    numero: 1,
    cliente: "Camila",
    total: 45000,
    monto_pagado: 45000,
    moneda: "COP",
    estado: "por_verificar",
    created_at: "2026-11-22T15:00:00Z",
    ...extra,
  };
}

describe("armarPendientes", () => {
  it("marca como 'no cuadra' un pago menor al total, con el monto en pesos", () => {
    const [p] = armarPendientes([pedido({ monto_pagado: 38000 })], [parrilla]);
    expect(p.tipo).toBe("no_cuadra");
    expect(p.detalle).toContain("Pedido #1 de Camila");
    expect(p.detalle).toContain("38.000");
    expect(p.detalle).toContain("45.000");
    expect(p.href).toBe("/portal/negocios/la-parrilla/pedidos");
  });

  it("monto_pagado en 0 no es 'no cuadra': es un monto que no se pudo leer", () => {
    const [p] = armarPendientes([pedido({ monto_pagado: 0 })], [parrilla]);
    expect(p.tipo).toBe("por_aprobar");
  });

  it("una señal alta del comprobante también es 'no cuadra' y usa su detalle", () => {
    const [p] = armarPendientes(
      [pedido({ comprobantes: { señales: [{ nivel: "media", detalle: "x" }, { nivel: "alta", detalle: "La referencia ya se usó" }] } })],
      [parrilla],
    );
    expect(p.tipo).toBe("no_cuadra");
    expect(p.detalle).toContain("La referencia ya se usó");
  });

  it("agrupa los pedidos por aprobar por negocio y nombra el negocio si hay varios", () => {
    const lista = armarPendientes(
      [pedido({ numero: 1 }), pedido({ numero: 2 }), pedido({ numero: 3, negocio_id: "n2" })],
      [parrilla, estetica],
    );
    expect(lista).toHaveLength(2);
    expect(lista[0].titulo).toBe("2 pedidos esperan su aprobación");
    expect(lista[0].detalle).toContain("· La Parrilla");
    expect(lista[1].titulo).toBe("1 pedido espera su aprobación");
  });

  it("con un solo negocio no repite su nombre en cada aviso", () => {
    const [p] = armarPendientes([pedido({})], [parrilla]);
    expect(p.detalle).not.toContain("La Parrilla");
  });

  it("ordena: primero lo que no cuadra, después aprobar, después devoluciones", () => {
    const lista = armarPendientes(
      [
        pedido({ numero: 1, estado: "entregado", devolucion_estado: "pendiente" }),
        pedido({ numero: 2 }),
        pedido({ numero: 3, monto_pagado: 1000 }),
      ],
      [parrilla],
    );
    expect(lista.map((p) => p.tipo)).toEqual(["no_cuadra", "por_aprobar", "devolucion"]);
  });

  it("ignora pedidos de negocios que no son de la dueña y estados que no esperan nada", () => {
    const lista = armarPendientes(
      [pedido({ negocio_id: "otro" }), pedido({ estado: "aprobado" }), pedido({ estado: "esperando_pago" })],
      [parrilla],
    );
    expect(lista).toEqual([]);
  });
});

describe("pedidosDeHoy y totalVendido", () => {
  const desde = new Date("2026-11-22T05:00:00Z");

  it("cuenta solo los de hoy que no fueron rechazados ni vencieron", () => {
    const hoy = pedidosDeHoy(
      [
        pedido({ created_at: "2026-11-21T20:00:00Z" }),
        pedido({ estado: "rechazado" }),
        pedido({ estado: "vencido" }),
        pedido({ estado: "aprobado", total: 10000 }),
        pedido({}),
      ],
      desde,
    );
    expect(hoy).toHaveLength(2);
    expect(totalVendido(hoy)).toContain("55.000");
  });

  it("no suma monedas distintas", () => {
    expect(totalVendido([pedido({}), pedido({ moneda: "VES" })])).toBeNull();
  });

  it("sin pedidos no hay total", () => {
    expect(totalVendido([])).toBeNull();
  });
});

describe("saludo y fechaLarga (hora de Colombia, no del servidor)", () => {
  it("a las 8 p. m. en Cúcuta (1 a. m. UTC) dice buenas noches", () => {
    expect(saludo(new Date("2026-11-23T01:00:00Z"))).toBe("Buenas noches");
  });

  it("a las 9 a. m. dice buenos días y a las 3 p. m. buenas tardes", () => {
    expect(saludo(new Date("2026-11-22T14:00:00Z"))).toBe("Buenos días");
    expect(saludo(new Date("2026-11-22T20:00:00Z"))).toBe("Buenas tardes");
  });

  it("la fecha sale con mayúscula inicial y en el día de Colombia", () => {
    // 1 a. m. UTC del 23 todavía es domingo 22 en Cúcuta.
    expect(fechaLarga(new Date("2026-11-23T01:00:00Z"))).toBe("Domingo 22 de noviembre");
  });
});
