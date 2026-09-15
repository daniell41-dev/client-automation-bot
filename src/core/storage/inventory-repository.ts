/**
 * Stock por producto (T-21): se valida y descuenta atómicamente al confirmar
 * un pedido. Vive en su propia tabla (no en `negocios.config`) — ver el
 * comentario de la migración 0010 para el porqué.
 */

/** Una línea del carrito a descontar. */
export interface StockItem {
  serviceId: string;
  cantidad: number;
}

/** Resultado de intentar descontar un carrito completo. */
export interface StockResult {
  ok: boolean;
  /** `serviceId` de los productos sin stock suficiente (solo si `ok` es `false`). */
  faltantes?: string[];
  /**
   * T-22.2: nivel resultante de cada producto TRACKEADO tras el descuento
   * (solo si `ok` es `true`) — lo que permite detectar stock bajo sin una
   * consulta aparte. Un producto sin stock configurado no aparece acá.
   */
  restante?: { serviceId: string; stock: number }[];
}

export interface InventoryRepository {
  /**
   * Fija (reemplaza) el stock de un producto — lo que el dueño escribió en
   * el editor de catálogo del portal. No es un delta: cada llamada dice
   * "hoy hay N unidades", no "sumale N".
   */
  setStock(negocio: string, serviceId: string, stock: number): Promise<void>;
  /**
   * Valida y descuenta TODO el carrito de una — o nada, si algún producto no
   * alcanza. Un producto sin stock configurado (nunca se llamó `setStock`)
   * se considera sin límite y nunca bloquea la operación.
   */
  decrementCart(negocio: string, items: StockItem[]): Promise<StockResult>;
  /**
   * T-22.2: ¿corresponde avisarle al dueño que este producto quedó bajo?
   * Atómico: marca la alerta como "ya enviada hoy" en el mismo paso que la
   * valida — `true` la primera vez del día (avisar), `false` si ya se había
   * avisado (no repetir). Sin esto, varias ventas seguidas del mismo
   * producto bajo mandarían una alerta cada una.
   */
  markLowStockAlert(negocio: string, serviceId: string): Promise<boolean>;
  /**
   * T-22.3: stock EN VIVO de todos los productos trackeados de un negocio
   * (`serviceId` → cantidad). El editor de catálogo del portal lo usa para
   * no mostrar el número viejo de `negocios.config` — sin esto, guardar el
   * catálogo sin tocar el stock pisaría lo que ya se descontó por ventas.
   */
  getStock(negocio: string): Promise<Record<string, number>>;
}
