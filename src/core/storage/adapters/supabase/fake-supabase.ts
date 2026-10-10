/**
 * Fake en memoria de `SupabaseDb` para tests (sin red ni credenciales).
 * Espejo del patrón `fake-sheets.ts` del adaptador de Google.
 */

import { randomUUID } from "node:crypto";
import type {
  ComprobanteRow,
  LeadRow,
  PedidoRow,
  NegocioRow,
  SessionRow,
  SupabaseDb,
} from "@/core/storage/adapters/supabase/api";

/** Fila acumulada de `uso_ia`, espejo de la migración 0005. */
interface UsoIaRow {
  negocio_id: string;
  proveedor: string;
  llamadas: number;
  tokens_in: number;
  tokens_out: number;
  fallbacks: number;
  imagenes: number;
}

/** Fila de `inventario`, espejo de las migraciones 0010 y 0011. */
interface InventarioRow {
  negocio_id: string;
  service_id: string;
  stock: number;
  /** T-22.2: qué día se avisó por última vez que este producto quedó bajo. */
  alertado_en?: string | null;
}

/** Llaves de Wompi de un negocio, espejo de las columnas de la migración 0014. */
interface WompiCredenciales {
  publicKey: string;
  integritySecret: string;
  eventsSecret: string;
}

interface FakeSupabaseDb extends SupabaseDb {
  /** Acceso directo a las filas para asserts y seeding en tests. */
  leads: LeadRow[];
  sesiones: SessionRow[];
  negocios: NegocioRow[];
  mensajesProcesados: Set<string>;
  usoIa: UsoIaRow[];
  inventario: InventarioRow[];
  comprobantes: ComprobanteRow[];
  pedidos: PedidoRow[];
  /** Seedear con `wompiCredenciales.set(negocioId, {...})` en los tests. */
  wompiCredenciales: Map<string, WompiCredenciales>;
}

export function makeFakeSupabaseDb(): FakeSupabaseDb {
  const leads: LeadRow[] = [];
  const sesiones: SessionRow[] = [];
  const negocios: NegocioRow[] = [];
  const mensajesProcesados = new Set<string>();
  const usoIa: UsoIaRow[] = [];
  const inventario: InventarioRow[] = [];
  const comprobantes: ComprobanteRow[] = [];
  const pedidos: PedidoRow[] = [];
  const wompiCredenciales = new Map<string, WompiCredenciales>();

  return {
    leads,
    sesiones,
    negocios,
    mensajesProcesados,
    usoIa,
    inventario,
    comprobantes,
    pedidos,
    wompiCredenciales,

    async selectLeadByContact(businessSlug, contact) {
      return (
        leads.find(
          (l) => l.business_slug === businessSlug && l.contact === contact,
        ) ?? null
      );
    },

    async selectLeadById(id) {
      return leads.find((l) => l.id === id) ?? null;
    },

    async upsertLead(row) {
      const i = leads.findIndex((l) => l.id === row.id);
      if (i >= 0) leads[i] = { ...row };
      else leads.push({ ...row });
    },

    async listLeads(businessSlug) {
      const filtered = businessSlug
        ? leads.filter((l) => l.business_slug === businessSlug)
        : leads;
      return [...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async selectSession(businessSlug, contact, channel) {
      return (
        sesiones.find(
          (s) =>
            s.business_slug === businessSlug &&
            s.contact === contact &&
            s.channel === channel,
        ) ?? null
      );
    },

    async upsertSession(row) {
      const i = sesiones.findIndex(
        (s) =>
          s.business_slug === row.business_slug &&
          s.contact === row.contact &&
          s.channel === row.channel,
      );
      if (i >= 0) sesiones[i] = { ...row };
      else sesiones.push({ ...row });
    },

    async selectNegocioBySlug(slug) {
      return negocios.find((n) => n.slug === slug) ?? null;
    },

    async selectNegocioByPhoneNumberId(id) {
      return negocios.find((n) => n.whatsapp_phone_number_id === id) ?? null;
    },

    async claimMessage(messageId) {
      if (mensajesProcesados.has(messageId)) return false;
      mensajesProcesados.add(messageId);
      return true;
    },

    async recordAiUsage(entry) {
      const fila = usoIa.find(
        (u) => u.negocio_id === entry.negocioId && u.proveedor === entry.proveedor,
      );
      const delta = {
        llamadas: entry.llamadas ?? 0,
        tokens_in: entry.tokensIn ?? 0,
        tokens_out: entry.tokensOut ?? 0,
        fallbacks: entry.fallbacks ?? 0,
        imagenes: entry.imagenes ?? 0,
      };
      if (fila) {
        fila.llamadas += delta.llamadas;
        fila.tokens_in += delta.tokens_in;
        fila.tokens_out += delta.tokens_out;
        fila.fallbacks += delta.fallbacks;
        fila.imagenes += delta.imagenes;
      } else {
        usoIa.push({ negocio_id: entry.negocioId, proveedor: entry.proveedor, ...delta });
      }
    },

    async setStock(negocioId, serviceId, stock) {
      const fila = inventario.find(
        (i) => i.negocio_id === negocioId && i.service_id === serviceId,
      );
      if (fila) fila.stock = stock;
      else inventario.push({ negocio_id: negocioId, service_id: serviceId, stock });
    },

    async decrementStockCarrito(negocioId, items) {
      // Mismo algoritmo que la función SQL: primero se valida TODO, después
      // se descuenta TODO — nunca queda a mitad de camino.
      const faltantes: string[] = [];
      for (const item of items) {
        const fila = inventario.find(
          (i) => i.negocio_id === negocioId && i.service_id === item.serviceId,
        );
        if (fila && fila.stock < item.cantidad) faltantes.push(item.serviceId);
      }
      if (faltantes.length > 0) return { ok: false, faltantes };

      // T-22.2: solo los productos SÍ trackeados entran en `restante`.
      const restante: { serviceId: string; stock: number }[] = [];
      for (const item of items) {
        const fila = inventario.find(
          (i) => i.negocio_id === negocioId && i.service_id === item.serviceId,
        );
        if (fila) {
          fila.stock -= item.cantidad;
          restante.push({ serviceId: item.serviceId, stock: fila.stock });
        }
      }
      return { ok: true, restante };
    },

    async markLowStockAlert(negocioId, serviceId) {
      const fila = inventario.find(
        (i) => i.negocio_id === negocioId && i.service_id === serviceId,
      );
      if (!fila) return false;
      const hoy = new Date().toISOString().slice(0, 10);
      if (fila.alertado_en === hoy) return false;
      fila.alertado_en = hoy;
      return true;
    },

    async insertComprobante(row) {
      // Espejo del índice único `comprobantes_ref_unica` (0013): una
      // referencia no nula no se puede repetir en el mismo negocio.
      if (row.referencia) {
        const duplicada = comprobantes.some(
          (c) => c.negocio_id === row.negocioId && c.referencia === row.referencia,
        );
        if (duplicada) {
          const error = new Error(
            'duplicate key value violates unique constraint "comprobantes_ref_unica"',
          ) as Error & { code?: string };
          error.code = "23505";
          throw error;
        }
      }
      const nueva: ComprobanteRow = {
        id: randomUUID(),
        negocio_id: row.negocioId,
        lead_id: row.leadId ?? null,
        referencia: row.referencia ?? null,
        monto: row.monto ?? null,
        moneda: row.moneda ?? null,
        banco: row.banco ?? null,
        fecha_comprobante: row.fechaComprobante ?? null,
        estado: "pendiente",
        señales: row.señales ?? null,
        created_at: new Date().toISOString(),
      };
      comprobantes.push(nueva);
      return nueva;
    },

    async listComprobantes(negocioId) {
      return comprobantes.filter((c) => c.negocio_id === negocioId);
    },

    async selectWompiCredentials(negocioId) {
      return wompiCredenciales.get(negocioId) ?? null;
    },

    async insertPedido(row) {
      // Espejo de `crear_pedido` (0015): siguiente número del negocio.
      const ultimo = pedidos
        .filter((p) => p.negocio_id === row.negocioId)
        .reduce((max, p) => Math.max(max, p.numero), 0);
      const ahora = new Date().toISOString();
      const nueva: PedidoRow = {
        id: randomUUID(),
        negocio_id: row.negocioId,
        numero: ultimo + 1,
        lead_id: row.leadId,
        contacto: row.contacto,
        cliente: row.cliente ?? null,
        items: row.items,
        total: row.total,
        moneda: row.moneda,
        modalidad: row.modalidad ?? null,
        direccion: row.direccion ?? null,
        estado: row.estado,
        codigo_retiro: null,
        comprobante_id: null,
        stock_reservado: row.stockReservado ?? false,
        created_at: ahora,
        updated_at: ahora,
      };
      pedidos.push(nueva);
      return nueva;
    },

    async updatePedidoEstado(id, estado) {
      const pedido = pedidos.find((p) => p.id === id);
      if (!pedido) throw new Error(`No existe el pedido ${id}`);
      pedido.estado = estado;
      pedido.updated_at = new Date().toISOString();
    },

    async returnStockCarrito(negocioId, items) {
      for (const item of items) {
        const fila = inventario.find((i) => i.negocio_id === negocioId && i.service_id === item.serviceId);
        if (fila) fila.stock += item.cantidad;
      }
    },

    async selectPedidoById(id) {
      return pedidos.find((p) => p.id === id) ?? null;
    },

    async selectPedidoPorNumero(negocioId, numero) {
      return pedidos.find((p) => p.negocio_id === negocioId && p.numero === numero) ?? null;
    },

    async selectPedidosPorEstado(negocioId, estados) {
      return pedidos
        .filter((p) => p.negocio_id === negocioId && estados.includes(p.estado))
        .sort((a, b) => a.numero - b.numero);
    },

    async updatePedidoComprobante(id, comprobanteId) {
      const pedido = pedidos.find((p) => p.id === id);
      if (!pedido) throw new Error(`No existe el pedido ${id}`);
      pedido.comprobante_id = comprobanteId;
    },

    async updateComprobanteEstado(id, estado) {
      const comprobante = comprobantes.find((c) => c.id === id);
      if (!comprobante) throw new Error(`No existe el comprobante ${id}`);
      comprobante.estado = estado as ComprobanteRow["estado"];
    },

    async selectPedidosAbiertosDeLead(leadId, estadosCerrados) {
      return pedidos
        .filter((p) => p.lead_id === leadId && !estadosCerrados.includes(p.estado))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  };
}
