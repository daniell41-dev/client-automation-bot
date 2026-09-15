/**
 * Adaptador de stock por archivo JSON (fallback sin credenciales, igual
 * criterio que `usage-json.ts`). Leer-restar-escribir, no atómico bajo
 * concurrencia — suficiente para desarrollo de un solo proceso; la garantía
 * real (sin condición de carrera) vive en `descontar_stock_carrito` del lado
 * de Supabase (migración 0010).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  InventoryRepository,
  StockItem,
  StockResult,
} from "@/core/storage/inventory-repository";

/** Ruta por defecto del archivo (gitignorado, igual que `data/uso-ia.json`). */
export function defaultInventoryFile(): string {
  return process.env.INVENTORY_FILE ?? join(process.cwd(), "data", "inventario.json");
}

export class JsonInventoryRepository implements InventoryRepository {
  constructor(private readonly filePath: string = defaultInventoryFile()) {}

  private async readAll(): Promise<Record<string, number>> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  private async writeAll(map: Record<string, number>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(map, null, 2), "utf8");
  }

  private key(negocio: string, serviceId: string): string {
    return `${negocio}|${serviceId}`;
  }

  async setStock(negocio: string, serviceId: string, stock: number): Promise<void> {
    const map = await this.readAll();
    map[this.key(negocio, serviceId)] = stock;
    await this.writeAll(map);
  }

  async decrementCart(negocio: string, items: StockItem[]): Promise<StockResult> {
    const map = await this.readAll();
    const faltantes: string[] = [];
    for (const item of items) {
      const key = this.key(negocio, item.serviceId);
      // Sin fila (`undefined`): el producto no está bajo control de stock —
      // nunca bloquea, mismo criterio que la función SQL.
      const disponible = map[key];
      if (disponible !== undefined && disponible < item.cantidad) {
        faltantes.push(item.serviceId);
      }
    }
    if (faltantes.length > 0) return { ok: false, faltantes };

    for (const item of items) {
      const key = this.key(negocio, item.serviceId);
      if (map[key] !== undefined) map[key] -= item.cantidad;
    }
    await this.writeAll(map);
    return { ok: true };
  }
}
