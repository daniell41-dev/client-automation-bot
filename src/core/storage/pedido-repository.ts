/**
 * Pedidos (T-30, ADR-004): cada venta confirmada por el cliente es una fila
 * propia, con número corto por negocio, en vez de vivir adentro del lead.
 *
 * El número (`numero`) lo asigna el almacenamiento, no quien llama: tiene
 * que ser único y correlativo por negocio aunque entren dos pedidos en el
 * mismo instante, y eso solo se garantiza en la base (ver migración 0015).
 */

export type EstadoPedido =
  | "esperando_pago"
  | "por_verificar"
  | "aprobado"
  | "listo"
  | "entregado"
  | "rechazado"
  | "vencido";

/**
 * Una línea del pedido, con nombre y precio COPIADOS del catálogo al momento
 * de pedir: si la dueña cambia el precio mañana, el pedido de hoy tiene que
 * seguir diciendo lo que el cliente aceptó pagar.
 */
export interface ItemPedido {
  serviceId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface NuevoPedido {
  /** UUID del negocio en Supabase, o su slug en el fallback JSON local. */
  negocio: string;
  leadId: string;
  /** Mismo identificador que `Lead.contact` (el WhatsApp del cliente). */
  contacto: string;
  cliente?: string;
  items: ItemPedido[];
  total: number;
  moneda: string;
  modalidad?: string;
  direccion?: string;
  estado: EstadoPedido;
  /**
   * T-32: si este pedido descontó stock al crearse. Con Wompi el descuento
   * recién ocurre cuando la pasarela confirma, así que un pedido de Wompi
   * pendiente no tiene nada que devolver.
   */
  stockReservado?: boolean;
}

export interface Pedido extends NuevoPedido {
  id: string;
  /** Correlativo por negocio (#1, #2, …) — lo que ven la dueña y el cliente. */
  numero: number;
  /** T-37: se genera al aprobar. */
  codigoRetiro?: string;
  /** T-31: el comprobante que respalda este pedido, si lo hay. */
  comprobanteId?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface PedidoRepository {
  /** Inserta el pedido asignándole el siguiente número del negocio. */
  crear(pedido: NuevoPedido): Promise<Pedido>;

  /**
   * Cambia el estado. La validez de la transición la decide quien llama
   * (`pedido-estado.ts`); el repositorio solo persiste.
   */
  actualizarEstado(id: string, estado: EstadoPedido): Promise<void>;

  /**
   * El pedido más reciente del lead que todavía no se cerró, o `null`. Un
   * cliente tiene a lo sumo un pedido abierto a la vez: confirmar uno nuevo
   * solo es posible después de que el anterior se cerró.
   */
  abiertoDeLead(leadId: string): Promise<Pedido | null>;

  /** T-31: un pedido por id (el que viaja en el botón del aviso), o `null`. */
  obtener(id: string): Promise<Pedido | null>;

  /** T-31: un pedido por su número corto dentro del negocio ("SÍ 12"), o `null`. */
  porNumero(negocio: string, numero: number): Promise<Pedido | null>;

  /** T-31: los pedidos del negocio que esperan una decisión, del más viejo al más nuevo. */
  pendientesDeDecision(negocio: string): Promise<Pedido[]>;

  /** T-31: asocia el comprobante que respalda el pedido. */
  vincularComprobante(id: string, comprobanteId: string): Promise<void>;
}
