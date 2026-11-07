import { describe, expect, it } from "vitest";
import { SupabasePedidoRepository } from "@/core/storage/adapters/supabase/pedidos";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";
import type { NuevoPedido } from "@/core/storage/pedido-repository";

function nuevo(overrides: Partial<NuevoPedido> = {}): NuevoPedido {
  return {
    negocio: "neg-1",
    leadId: "lead-1",
    contacto: "573001112233",
    cliente: "Laura",
    items: [{ serviceId: "bandeja", nombre: "Bandeja paisa", cantidad: 2, precioUnitario: 28000 }],
    total: 56000,
    moneda: "COP",
    modalidad: "Recoger en el local",
    estado: "por_verificar",
    ...overrides,
  };
}

describe("SupabasePedidoRepository", () => {
  it("crea el pedido con número correlativo por negocio y conserva los ítems", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabasePedidoRepository(db);

    const a = await repo.crear(nuevo());
    const b = await repo.crear(nuevo({ leadId: "lead-2" }));
    const otro = await repo.crear(nuevo({ negocio: "neg-2", leadId: "lead-3" }));

    expect([a.numero, b.numero, otro.numero]).toEqual([1, 2, 1]);
    expect(a.items[0]).toMatchObject({ nombre: "Bandeja paisa", cantidad: 2, precioUnitario: 28000 });
    expect(a.modalidad).toBe("Recoger en el local");
    expect(db.pedidos).toHaveLength(3);
  });

  it("actualizarEstado persiste el nuevo estado", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabasePedidoRepository(db);
    const pedido = await repo.crear(nuevo());

    await repo.actualizarEstado(pedido.id, "aprobado");

    expect(db.pedidos[0].estado).toBe("aprobado");
  });

  it("T-66: registrarPago guarda lo pagado y se lee de vuelta; sin la columna se lee como nada pagado", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabasePedidoRepository(db);
    const pedido = await repo.crear(nuevo());
    expect((await repo.obtener(pedido.id))?.montoPagado).toBeUndefined();

    await repo.registrarPago(pedido.id, 20000);

    expect(db.pedidos[0].monto_pagado).toBe(20000);
    expect((await repo.obtener(pedido.id))?.montoPagado).toBe(20000);
  });

  it("T-67: el ciclo de la devolución — pedir cuenta, guardarla, marcar devuelto", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabasePedidoRepository(db);
    const pedido = await repo.crear(nuevo());
    expect(await repo.esperandoCuentaDeLead("lead-1")).toBeNull();

    await repo.pedirCuentaDevolucion(pedido.id);
    expect((await repo.esperandoCuentaDeLead("lead-1"))?.devolucion).toEqual({ estado: "pidiendo_cuenta" });

    await repo.guardarCuentaDevolucion(pedido.id, "Nequi 3001234567");
    expect(await repo.esperandoCuentaDeLead("lead-1")).toBeNull();
    expect((await repo.obtener(pedido.id))?.devolucion).toEqual({ estado: "pendiente", cuenta: "Nequi 3001234567" });

    await repo.marcarDevuelto(pedido.id, "2026-11-07T18:00:00.000Z");
    expect((await repo.obtener(pedido.id))?.devolucion).toEqual({
      estado: "devuelta",
      cuenta: "Nequi 3001234567",
      devueltaEn: "2026-11-07T18:00:00.000Z",
    });
  });

  it("abiertoDeLead devuelve el abierto y nunca uno cerrado", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabasePedidoRepository(db);
    const viejo = await repo.crear(nuevo());
    await repo.actualizarEstado(viejo.id, "entregado");

    expect(await repo.abiertoDeLead("lead-1")).toBeNull();

    const actual = await repo.crear(nuevo());
    expect((await repo.abiertoDeLead("lead-1"))?.id).toBe(actual.id);
  });
});
