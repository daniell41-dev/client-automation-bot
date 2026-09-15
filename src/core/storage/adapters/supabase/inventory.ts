/**
 * Adaptador de stock sobre Supabase (T-21). Traduce `InventoryRepository` a
 * `setStock`/`decrementStockCarrito` de `SupabaseDb` — ver migración 0010.
 */

import type {
  InventoryRepository,
  StockItem,
  StockResult,
} from "@/core/storage/inventory-repository";
import type { SupabaseDb } from "@/core/storage/adapters/supabase/api";

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private readonly db: SupabaseDb) {}

  async setStock(negocio: string, serviceId: string, stock: number): Promise<void> {
    await this.db.setStock(negocio, serviceId, stock);
  }

  async decrementCart(negocio: string, items: StockItem[]): Promise<StockResult> {
    const result = await this.db.decrementStockCarrito(
      negocio,
      items.map((i) => ({ serviceId: i.serviceId, cantidad: i.cantidad })),
    );
    return result;
  }
}
