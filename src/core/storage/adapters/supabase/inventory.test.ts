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

    expect(result).toEqual({ ok: true });
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

    expect(result).toEqual({ ok: true });
  });

  it("stock justo (igual a la cantidad pedida) alcanza", async () => {
    const db = makeFakeSupabaseDb();
    const repo = new SupabaseInventoryRepository(db);
    await repo.setStock("neg-1", "harina", 2);

    const result = await repo.decrementCart("neg-1", [{ serviceId: "harina", cantidad: 2 }]);

    expect(result).toEqual({ ok: true });
    expect(db.inventario).toContainEqual({ negocio_id: "neg-1", service_id: "harina", stock: 0 });
  });
});
