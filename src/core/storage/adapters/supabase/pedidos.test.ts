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
