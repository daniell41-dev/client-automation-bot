/**
 * Adaptador de idempotencia por archivo JSON (fallback sin credenciales,
 * igual criterio que `json.ts` para leads).
 *
 * Guarda un mapa `messageId -> processedAt` (no un array: el lookup es la
 * ruta caliente — una vez por mensaje entrante — y un mapa es O(1) en vez de
 * recorrer todo el archivo). Al reclamar, poda las entradas más viejas que
 * `PRUNE_AFTER_MS` para que el archivo no crezca sin límite; Meta no
 * reintenta pasados unos pocos días, así que no hace falta guardar más.
 *
 * Atomicidad: sólo garantizada dentro de UN proceso de Node (el mismo
 * supuesto que el resto de los adaptadores JSON — son el fallback de
 * desarrollo/negocio chico, no la ruta multi-instancia; para eso está
 * Supabase, con una restricción `unique` real en la base).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { MessageDedupeRepository } from "@/core/storage/dedupe-repository";

/** Cuánto se conserva un `messageId` antes de poder olvidarlo (7 días). */
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Ruta por defecto del archivo (gitignorado, igual que `data/leads.json`). */
export function defaultDedupeFile(): string {
  return process.env.DEDUPE_FILE ?? join(process.cwd(), "data", "processed-messages.json");
}

export class JsonMessageDedupeRepository implements MessageDedupeRepository {
  constructor(private readonly filePath: string = defaultDedupeFile()) {}

  private async readAll(): Promise<Record<string, string>> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  private async writeAll(map: Record<string, string>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(map, null, 2), "utf8");
  }

  async claim(messageId: string): Promise<boolean> {
    const map = await this.readAll();
    if (messageId in map) return false;

    map[messageId] = new Date().toISOString();
    const cutoff = Date.now() - PRUNE_AFTER_MS;
    for (const [id, processedAt] of Object.entries(map)) {
      if (new Date(processedAt).getTime() < cutoff) delete map[id];
    }

    await this.writeAll(map);
    return true;
  }
}
