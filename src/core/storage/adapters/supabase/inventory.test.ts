import { describe, expect, it } from "vitest";
import { SupabaseInventoryRepository } from "@/core/storage/adapters/supabase/inventory";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";

describe("SupabaseInventoryRepository — setStock", () => {
  it("crea la fila la primera vez", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);

    await repo.setStock("neg-1", "harina", 10);

    expect(db.inventario).toEqual([{ negocio_id: "neg-1", service_id: "harina", stock: 10 }]);
  });

  it("REEMPLAZA el valor, no lo suma (el dueño dice 'hoy hay N', no 'sumale N')", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);

    await repo.setStock("neg-1", "harina", 10);
    await repo.setStock("neg-1", "harina", 3);

    expect(db.inventario).toEqual([{ negocio_id: "neg-1", service_id: "harina", stock: 3 }]);
  });

  it("negocio y producto distintos son filas independientes", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);

    await repo.setStock("neg-1", "harina", 10);
    await repo.setStock("neg-1", "aceite", 5);
    await repo.setStock("neg-2", "harina", 20);

    expect(db.inventario).toHaveLength(3);
  });
});

describe("SupabaseInventoryRepository — decrementCart", () => {
  it("descuenta cuando alcanza el stock de todos los productos", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    await repo.setStock("neg-1", "harina", 10);
    await repo.setStock("neg-1", "aceite", 5);

    const result = await repo.decrementCart("neg-1", [
      { serviceId: "harina", cantidad: 2 },
      { serviceId: "aceite", cantidad: 1 },
    ]);

    expect(result).toEqual({
      ok: true,
      restante: [
        { serviceId: "harina", stock: 8 },
        { serviceId: "aceite", stock: 4 },
      ],
    });
    expect(db.inventario).toContainEqual({ negocio_id: "neg-1", service_id: "harina", stock: 8 });
    expect(db.inventario).toContainEqual({ negocio_id: "neg-1", service_id: "aceite", stock: 4 });
  });

  it("si UN producto no alcanza, no descuenta NADA del carrito", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    await repo.setStock("neg-1", "harina", 10);
    await repo.setStock("neg-1", "aceite", 1);

    const result = await repo.decrementCart("neg-1", [
      { serviceId: "harina", cantidad: 2 },
      { serviceId: "aceite", cantidad: 5 }, // no alcanza
    ]);

    expect(result).toEqual({ ok: false, faltantes: ["aceite"] });
    // La harina NO se tocó, aunque sí alcanzaba.
    expect(db.inventario).toContainEqual({ negocio_id: "neg-1", service_id: "harina", stock: 10 });
  });

  it("un producto SIN fila (nunca se llamó setStock) nunca bloquea — sin límite", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    // "aceite" no tiene fila en `inventario`.

    const result = await repo.decrementCart("neg-1", [{ serviceId: "aceite", cantidad: 1000 }]);

    // Sin fila -> no bloquea, y tampoco aparece en `restante` (nunca se le
    // descontó nada real).
    expect(result).toEqual({ ok: true, restante: [] });
  });

  it("stock justo (igual a la cantidad pedida) alcanza", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    await repo.setStock("neg-1", "harina", 2);

    const result = await repo.decrementCart("neg-1", [{ serviceId: "harina", cantidad: 2 }]);

    expect(result).toEqual({ ok: true, restante: [{ serviceId: "harina", stock: 0 }] });
    expect(db.inventario).toContainEqual({ negocio_id: "neg-1", service_id: "harina", stock: 0 });
  });
});

describe("SupabaseInventoryRepository — markLowStockAlert (T-22.2)", () => {
  it("la primera vez del día corresponde avisar", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    await repo.setStock("neg-1", "harina", 2);

    expect(await repo.markLowStockAlert("neg-1", "harina")).toBe(true);
  });

  it("una segunda vez el mismo día NO vuelve a avisar", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    await repo.setStock("neg-1", "harina", 2);

    expect(await repo.markLowStockAlert("neg-1", "harina")).toBe(true);
    expect(await repo.markLowStockAlert("neg-1", "harina")).toBe(false);
  });

  it("un producto sin fila (nunca se llamó setStock) no corresponde avisar", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    expect(await repo.markLowStockAlert("neg-1", "no-trackeado")).toBe(false);
  });
});

describe("SupabaseInventoryRepository — getStock (T-22.3)", () => {
  it("devuelve el stock EN VIVO de todos los productos trackeados del negocio", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    await repo.setStock("neg-1", "harina", 10);
    await repo.setStock("neg-1", "aceite", 5);
    await repo.decrementCart("neg-1", [{ serviceId: "harina", cantidad: 3 }]);

    expect(await repo.getStock("neg-1")).toEqual({ harina: 7, aceite: 5 });
  });

  it("no mezcla el stock de negocios distintos", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    await repo.setStock("neg-1", "harina", 10);
    await repo.setStock("neg-2", "harina", 2);

    expect(await repo.getStock("neg-1")).toEqual({ harina: 10 });
    expect(await repo.getStock("neg-2")).toEqual({ harina: 2 });
  });

  it("sin ningún producto trackeado, devuelve un objeto vacío", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    expect(await repo.getStock("neg-sin-stock")).toEqual({});
  });
});
