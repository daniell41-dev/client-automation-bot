import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonInventoryRepository } from "@/core/storage/adapters/inventory-json";

describe("JsonInventoryRepository", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "inventory-json-test-"));
    filePath = join(dir, "inventario.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("setStock REEMPLAZA el valor, no lo suma", async () => {
    const repo = new JsonInventoryRepository(filePath);
    await repo.setStock("tienda", "harina", 10);
    await repo.setStock("tienda", "harina", 3);

    const result = await repo.decrementCart("tienda", [{ serviceId: "harina", cantidad: 3 }]);
    expect(result).toEqual({ ok: true });
  });

  it("descuenta cuando alcanza y persiste entre instancias", async () => {
    await new JsonInventoryRepository(filePath).setStock("tienda", "harina", 10);

    const repo2 = new JsonInventoryRepository(filePath);
    const result = await repo2.decrementCart("tienda", [{ serviceId: "harina", cantidad: 4 }]);
    expect(result).toEqual({ ok: true });

    const repo3 = new JsonInventoryRepository(filePath);
    const insuficiente = await repo3.decrementCart("tienda", [{ serviceId: "harina", cantidad: 7 }]);
    expect(insuficiente).toEqual({ ok: false, faltantes: ["harina"] });
  });

  it("si un producto no alcanza, no descuenta nada del carrito", async () => {
    const repo = new JsonInventoryRepository(filePath);
    await repo.setStock("tienda", "harina", 10);
    await repo.setStock("tienda", "aceite", 1);

    const result = await repo.decrementCart("tienda", [
      { serviceId: "harina", cantidad: 2 },
      { serviceId: "aceite", cantidad: 5 },
    ]);
    expect(result).toEqual({ ok: false, faltantes: ["aceite"] });

    // La harina no se tocó.
    const check = await repo.decrementCart("tienda", [{ serviceId: "harina", cantidad: 10 }]);
    expect(check).toEqual({ ok: true });
  });

  it("un producto sin setStock nunca bloquea (sin límite)", async () => {
    const repo = new JsonInventoryRepository(filePath);
    const result = await repo.decrementCart("tienda", [{ serviceId: "no-trackeado", cantidad: 999 }]);
    expect(result).toEqual({ ok: true });
  });

  it("negocios distintos no se pisan el stock", async () => {
    const repo = new JsonInventoryRepository(filePath);
    await repo.setStock("tienda-a", "harina", 5);
    await repo.setStock("tienda-b", "harina", 1);

    const result = await repo.decrementCart("tienda-a", [{ serviceId: "harina", cantidad: 5 }]);
    expect(result).toEqual({ ok: true });
  });

  it("crea el directorio si no existe", async () => {
    const anidado = join(dir, "sub", "otra", "inventario.json");
    const repo = new JsonInventoryRepository(anidado);
    await expect(repo.setStock("tienda", "harina", 5)).resolves.not.toThrow();
  });
});
