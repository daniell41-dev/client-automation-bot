import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonPedidoRepository } from "@/core/storage/adapters/pedido-json";
import type { NuevoPedido } from "@/core/storage/pedido-repository";

function nuevo(overrides: Partial<NuevoPedido> = {}): NuevoPedido {
  return {
    negocio: "sabores",
    leadId: "lead-1",
    contacto: "573001112233",
    cliente: "Laura",
    items: [{ serviceId: "bandeja", nombre: "Bandeja paisa", cantidad: 2, precioUnitario: 28000 }],
    total: 56000,
    moneda: "COP",
    estado: "por_verificar",
    ...overrides,
  };
}

describe("JsonPedidoRepository", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "pedidos-json-test-"));
    filePath = join(dir, "pedidos.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("numera los pedidos de forma correlativa POR negocio", async () => {
    const repo = new JsonPedidoRepository(filePath);
    const a = await repo.crear(nuevo());
    const b = await repo.crear(nuevo({ leadId: "lead-2" }));
    const otroNegocio = await repo.crear(nuevo({ negocio: "estetica", leadId: "lead-3" }));

    expect(a.numero).toBe(1);
    expect(b.numero).toBe(2);
    expect(otroNegocio.numero).toBe(1);
  });

  it("actualiza el estado", async () => {
    const repo = new JsonPedidoRepository(filePath);
    const pedido = await repo.crear(nuevo());
    await repo.actualizarEstado(pedido.id, "aprobado");

    expect((await repo.abiertoDeLead("lead-1"))?.estado).toBe("aprobado");
  });

  it("abiertoDeLead ignora los pedidos cerrados del mismo cliente", async () => {
    const repo = new JsonPedidoRepository(filePath);
    const viejo = await repo.crear(nuevo());
    await repo.actualizarEstado(viejo.id, "rechazado");

    expect(await repo.abiertoDeLead("lead-1")).toBeNull();

    const nuevoPedido = await repo.crear(nuevo());
    expect((await repo.abiertoDeLead("lead-1"))?.id).toBe(nuevoPedido.id);
  });
});
