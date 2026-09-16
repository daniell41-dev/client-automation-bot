/**
 * Adaptador de stock por archivo JSON (fallback sin credenciales, igual
 * criterio que `usage-json.ts`). Leer-restar-escribir, no atómico bajo
 * concurrencia — suficiente para desarrollo de un solo proceso; la garantía
 * real (sin condición de carrera) vive en `descontar_stock_carrito`/
 * `marcar_alerta_stock_bajo` del lado de Supabase (migraciones 0010 y 0011).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  InventoryRepository,
  StockItem,
  StockResult,
} from "@/core/storage/inventory-repository";

/** Fila guardada por producto: el stock y, si aplica, el día de la última alerta (T-22.2). */
interface StoredStock {
  stock: number;
  alertadoEn?: string;
}

/** Ruta por defecto del archivo (gitignorado, igual que `data/uso-ia.json`). */
export function defaultInventoryFile(): string {
  return process.env.INVENTORY_FILE ?? join(process.cwd(), "data", "inventario.json");
}

/** "2026-06-30" en hora local — mismo formato que usa Postgres para `current_date`. */
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export class JsonInventoryRepository implements InventoryRepository {
  constructor(private readonly filePath: string = defaultInventoryFile()) {}

  private async readAll(): Promise<Record<string, StoredStock>> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredStock>) : {};
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  private async writeAll(map: Record<string, StoredStock>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(map, null, 2), "utf8");
  }

  private key(negocio: string, serviceId: string): string {
    return `${negocio}|${serviceId}`;
  }

  async setStock(negocio: string, serviceId: string, stock: number): Promise<void> {
    const map = await this.readAll();
    const key = this.key(negocio, serviceId);
    // Reemplaza el stock pero conserva `alertadoEn`: cargar de nuevo el
    // catálogo no debería "reabrir" la alerta de hoy si el producto sigue bajo.
    map[key] = { ...map[key], stock };
    await this.writeAll(map);
  }

  async decrementCart(negocio: string, items: StockItem[]): Promise<StockResult> {
    const map = await this.readAll();
    const faltantes: string[] = [];
    for (const item of items) {
      const fila = map[this.key(negocio, item.serviceId)];
      // Sin fila (`undefined`): el producto no está bajo control de stock —
      // nunca bloquea, mismo criterio que la función SQL.
      if (fila !== undefined && fila.stock < item.cantidad) {
        faltantes.push(item.serviceId);
      }
    }
    if (faltantes.length > 0) return { ok: false, faltantes };

    const restante: { serviceId: string; stock: number }[] = [];
    for (const item of items) {
      const key = this.key(negocio, item.serviceId);
      const fila = map[key];
      if (fila !== undefined) {
        fila.stock -= item.cantidad;
        restante.push({ serviceId: item.serviceId, stock: fila.stock });
      }
    }
    await this.writeAll(map);
    return { ok: true, restante };
  }

  async markLowStockAlert(negocio: string, serviceId: string): Promise<boolean> {
    const map = await this.readAll();
    const key = this.key(negocio, serviceId);
    const fila = map[key];
    if (!fila) return false;
    const hoy = hoyISO();
    if (fila.alertadoEn === hoy) return false;
    fila.alertadoEn = hoy;
    await this.writeAll(map);
    return true;
  }
}
