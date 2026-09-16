/**
 * Adaptador de comprobantes de pago por archivo JSON (fallback sin
 * credenciales, igual criterio que el resto de adaptadores JSON del repo).
 * Simula en memoria/archivo la misma restricción que el índice único
 * `comprobantes_ref_unica` de la migración 0013: una `referencia` no nula no
 * se puede repetir dentro del mismo negocio.
 *
 * Igual que el resto de adaptadores JSON: no es atómico bajo concurrencia
 * (leer-comparar-escribir) — suficiente para desarrollo de un solo proceso;
 * la garantía real vive en el índice único del lado de Supabase.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  Comprobante,
  ComprobanteRepository,
  NuevoComprobante,
} from "@/core/storage/comprobante-repository";

/** Ruta por defecto del archivo (gitignorado, igual que `data/leads.json`). */
export function defaultComprobantesFile(): string {
  return process.env.COMPROBANTES_FILE ?? join(process.cwd(), "data", "comprobantes.json");
}

export class JsonComprobanteRepository implements ComprobanteRepository {
  constructor(private readonly filePath: string = defaultComprobantesFile()) {}

  private async readAll(): Promise<Comprobante[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Comprobante[]) : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  private async writeAll(comprobantes: Comprobante[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(comprobantes, null, 2), "utf8");
  }

  async crear(nuevo: NuevoComprobante): Promise<Comprobante> {
    const todos = await this.readAll();
    if (nuevo.referencia) {
      const duplicada = todos.some(
        (c) => c.negocio === nuevo.negocio && c.referencia === nuevo.referencia,
      );
      if (duplicada) {
        throw new Error(
          `La referencia "${nuevo.referencia}" ya se usó en un comprobante de este negocio.`,
        );
      }
    }
    const comprobante: Comprobante = { ...nuevo, id: randomUUID(), estado: "pendiente" };
    todos.push(comprobante);
    await this.writeAll(todos);
    return comprobante;
  }
}
