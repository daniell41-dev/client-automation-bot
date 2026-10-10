/**
 * Adaptador de pedidos sobre Supabase (T-30). Traduce `PedidoRepository` a
 * `SupabaseDb` — el número correlativo lo asigna `crear_pedido` (migración
 * 0015), nunca este adaptador.
 */

import type { PedidoRow, SupabaseDb } from "@/core/storage/adapters/supabase/api";
import type {
  EstadoPedido,
  ItemPedido,
  NuevoPedido,
  Pedido,
  PedidoRepository,
} from "@/core/storage/pedido-repository";

/** Estados finales — mismos que `pedidoCerrado` en `pedido-estado.ts`. */
const ESTADOS_CERRADOS: EstadoPedido[] = ["entregado", "rechazado", "vencido"];
/** Esperando decisión — mismos que `pedidoPendienteDeDecision`. */
const ESTADOS_PENDIENTES: EstadoPedido[] = ["esperando_pago", "por_verificar"];

/** Exportada (T-38): el panel del portal lee filas con el cliente del dueño y las mapea igual. */
export function toPedido(row: PedidoRow): Pedido {
  return {
    id: row.id,
    numero: row.numero,
    negocio: row.negocio_id,
    leadId: row.lead_id ?? "",
    contacto: row.contacto,
    cliente: row.cliente ?? undefined,
    items: (row.items as ItemPedido[] | null) ?? [],
    total: Number(row.total),
    moneda: row.moneda,
    modalidad: row.modalidad ?? undefined,
    direccion: row.direccion ?? undefined,
    estado: row.estado as EstadoPedido,
    codigoRetiro: row.codigo_retiro ?? undefined,
    comprobanteId: row.comprobante_id ?? undefined,
    stockReservado: row.stock_reservado ?? false,
    creadoEn: row.created_at,
    actualizadoEn: row.updated_at,
  };
}

export class SupabasePedidoRepository implements PedidoRepository {
  constructor(private readonly db: SupabaseDb) {}

  async crear(pedido: NuevoPedido): Promise<Pedido> {
    const row = await this.db.insertPedido({
      negocioId: pedido.negocio,
      leadId: pedido.leadId,
      contacto: pedido.contacto,
      cliente: pedido.cliente,
      items: pedido.items,
      total: pedido.total,
      moneda: pedido.moneda,
      modalidad: pedido.modalidad,
      direccion: pedido.direccion,
      estado: pedido.estado,
      stockReservado: pedido.stockReservado,
    });
    return toPedido(row);
  }

  async actualizarEstado(id: string, estado: EstadoPedido): Promise<void> {
    await this.db.updatePedidoEstado(id, estado);
  }

  async abiertoDeLead(leadId: string): Promise<Pedido | null> {
    const rows = await this.db.selectPedidosAbiertosDeLead(leadId, ESTADOS_CERRADOS);
    return rows[0] ? toPedido(rows[0]) : null;
  }

  async obtener(id: string): Promise<Pedido | null> {
    const row = await this.db.selectPedidoById(id);
    return row ? toPedido(row) : null;
  }

  async porNumero(negocio: string, numero: number): Promise<Pedido | null> {
    const row = await this.db.selectPedidoPorNumero(negocio, numero);
    return row ? toPedido(row) : null;
  }

  async pendientesDeDecision(negocio: string): Promise<Pedido[]> {
    const rows = await this.db.selectPedidosPorEstado(negocio, ESTADOS_PENDIENTES);
    return rows.map(toPedido);
  }

  async reclamarAvisoResumen(negocio: string, minutos: number): Promise<boolean> {
    return this.db.claimAvisoResumen(negocio, minutos);
  }

  async asignarCodigoRetiro(id: string, codigo: string): Promise<void> {
    await this.db.updatePedidoCodigoRetiro(id, codigo);
  }

  async vincularComprobante(id: string, comprobanteId: string): Promise<void> {
    await this.db.updatePedidoComprobante(id, comprobanteId);
  }
}
