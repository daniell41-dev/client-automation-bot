/**
 * Adaptador de comprobantes de pago sobre Supabase (T-24.1). Traduce
 * `ComprobanteRepository` a `insertComprobante` de `SupabaseDb` — ver
 * migración 0013.
 */

import type {
  Comprobante,
  ComprobanteRepository,
  EstadoComprobante,
  ImagenComprobante,
  NuevoComprobante,
} from "@/core/storage/comprobante-repository";
import type { ComprobanteRow, SupabaseDb } from "@/core/storage/adapters/supabase/api";

function toComprobante(row: ComprobanteRow): Comprobante {
  return {
    id: row.id,
    negocio: row.negocio_id,
    leadId: row.lead_id ?? undefined,
    referencia: row.referencia ?? undefined,
    monto: row.monto ?? undefined,
    moneda: row.moneda ?? undefined,
    banco: row.banco ?? undefined,
    fechaComprobante: row.fecha_comprobante ?? undefined,
    estado: row.estado,
    señales: row.señales ?? undefined,
    creadoEn: row.created_at,
  };
}

export class SupabaseComprobanteRepository implements ComprobanteRepository {
  constructor(private readonly db: SupabaseDb) {}

  async crear(comprobante: NuevoComprobante): Promise<Comprobante> {
    const row = await this.db.insertComprobante({
      negocioId: comprobante.negocio,
      leadId: comprobante.leadId,
      referencia: comprobante.referencia,
      monto: comprobante.monto,
      moneda: comprobante.moneda,
      banco: comprobante.banco,
      fechaComprobante: comprobante.fechaComprobante,
      señales: comprobante.señales,
    });
    return toComprobante(row);
  }

  async listar(negocio: string): Promise<Comprobante[]> {
    const rows = await this.db.listComprobantes(negocio);
    return rows.map(toComprobante);
  }

  async actualizarEstado(id: string, estado: EstadoComprobante): Promise<void> {
    await this.db.updateComprobanteEstado(id, estado);
  }

  async adjuntarImagen(id: string, negocio: string, imagen: ImagenComprobante): Promise<void> {
    // La carpeta es el negocio: es lo que la política del bucket usa para
    // dejar leer a cada dueña solo lo suyo (migración 0018).
    const extension = imagen.mimeType.split("/")[1]?.split(";")[0] || "jpg";
    const bytes = Uint8Array.from(Buffer.from(imagen.base64, "base64"));
    await this.db.uploadComprobanteImagen(id, `${negocio}/${id}.${extension}`, bytes, imagen.mimeType);
  }
}
