/**
 * Adaptador de pedidos por archivo JSON (fallback sin credenciales, mismo
 * criterio que el resto de adaptadores JSON del repo). El número correlativo
 * se calcula leyendo-y-sumando, así que NO es atómico bajo concurrencia —
 * alcanza para desarrollo de un solo proceso; la garantía real vive en la
 * función `crear_pedido` de la migración 0015.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pedidoCerrado, pedidoPendienteDeDecision } from "@/core/engine/pedido-estado";
import type {
  EstadoPedido,
  NuevoPedido,
  Pedido,
  PedidoRepository,
} from "@/core/storage/pedido-repository";

/** Ruta por defecto del archivo (gitignorado, igual que `data/leads.json`). */
export function defaultPedidosFile(): string {
  return process.env.PEDIDOS_FILE ?? join(process.cwd(), "data", "pedidos.json");
}

export class JsonPedidoRepository implements PedidoRepository {
  constructor(private readonly filePath: string = defaultPedidosFile()) {}

  private async readAll(): Promise<Pedido[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Pedido[]) : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  private async writeAll(pedidos: Pedido[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(pedidos, null, 2), "utf8");
  }

  async crear(nuevo: NuevoPedido): Promise<Pedido> {
    const todos = await this.readAll();
    const ultimo = todos
      .filter((p) => p.negocio === nuevo.negocio)
      .reduce((max, p) => Math.max(max, p.numero), 0);
    const ahora = new Date().toISOString();
    const pedido: Pedido = {
      ...nuevo,
      id: randomUUID(),
      numero: ultimo + 1,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    todos.push(pedido);
    await this.writeAll(todos);
    return pedido;
  }

  async actualizarEstado(id: string, estado: EstadoPedido): Promise<void> {
    const todos = await this.readAll();
    const pedido = todos.find((p) => p.id === id);
    if (!pedido) throw new Error(`No existe el pedido ${id}`);
    pedido.estado = estado;
    pedido.actualizadoEn = new Date().toISOString();
    await this.writeAll(todos);
  }

  async abiertoDeLead(leadId: string): Promise<Pedido | null> {
    const abiertos = (await this.readAll())
      .filter((p) => p.leadId === leadId && !pedidoCerrado(p.estado))
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    return abiertos[0] ?? null;
  }

  async obtener(id: string): Promise<Pedido | null> {
    return (await this.readAll()).find((p) => p.id === id) ?? null;
  }

  async porNumero(negocio: string, numero: number): Promise<Pedido | null> {
    return (await this.readAll()).find((p) => p.negocio === negocio && p.numero === numero) ?? null;
  }

  async pendientesDeDecision(negocio: string): Promise<Pedido[]> {
    return (await this.readAll())
      .filter((p) => p.negocio === negocio && pedidoPendienteDeDecision(p.estado))
      .sort((a, b) => a.numero - b.numero);
  }

  async asignarCodigoRetiro(id: string, codigo: string): Promise<void> {
    const todos = await this.readAll();
    const pedido = todos.find((p) => p.id === id);
    if (!pedido) throw new Error(`No existe el pedido ${id}`);
    pedido.codigoRetiro = codigo;
    pedido.actualizadoEn = new Date().toISOString();
    await this.writeAll(todos);
  }

  async vincularComprobante(id: string, comprobanteId: string): Promise<void> {
    const todos = await this.readAll();
    const pedido = todos.find((p) => p.id === id);
    if (!pedido) throw new Error(`No existe el pedido ${id}`);
    pedido.comprobanteId = comprobanteId;
    pedido.actualizadoEn = new Date().toISOString();
    await this.writeAll(todos);
  }
}
