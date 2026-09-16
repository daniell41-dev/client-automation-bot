import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonComprobanteRepository } from "@/core/storage/adapters/comprobante-json";

describe("JsonComprobanteRepository", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "comprobantes-json-test-"));
    filePath = join(dir, "comprobantes.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("crea un comprobante nuevo en estado pendiente", async () => {
    const repo = new JsonComprobanteRepository(filePath);
    const comprobante = await repo.crear({ negocio: "tienda", referencia: "ABC123", monto: 45000 });

    expect(comprobante.estado).toBe("pendiente");
    expect(comprobante.id).toBeTruthy();
  });

  it("la MISMA referencia dos veces en el MISMO negocio falla", async () => {
    const repo = new JsonComprobanteRepository(filePath);
    await repo.crear({ negocio: "tienda", referencia: "ABC123" });

    await expect(repo.crear({ negocio: "tienda", referencia: "ABC123" })).rejects.toThrow();
  });

  it("la MISMA referencia en negocios DISTINTOS sí entra, incluso entre instancias", async () => {
    await new JsonComprobanteRepository(filePath).crear({ negocio: "tienda-a", referencia: "ABC123" });

    const repo2 = new JsonComprobanteRepository(filePath);
    await expect(repo2.crear({ negocio: "tienda-b", referencia: "ABC123" })).resolves.toMatchObject({
      negocio: "tienda-b",
      referencia: "ABC123",
    });
  });

  it("varios comprobantes sin referencia no chocan entre sí", async () => {
    const repo = new JsonComprobanteRepository(filePath);
    await repo.crear({ negocio: "tienda" });
    await repo.crear({ negocio: "tienda" });

    await expect(repo.crear({ negocio: "tienda", referencia: "XYZ" })).resolves.toBeTruthy();
  });

  it("crea el directorio si no existe", async () => {
    const anidado = join(dir, "sub", "otra", "comprobantes.json");
    const repo = new JsonComprobanteRepository(anidado);
    await expect(repo.crear({ negocio: "tienda", referencia: "ABC" })).resolves.toBeTruthy();
  });
});
