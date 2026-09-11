/**
 * Adaptador de consumo de IA por archivo JSON (fallback sin credenciales,
 * igual criterio que `dedupe-json.ts`). Solo para inspección local en
 * desarrollo: sin Supabase no hay `negocios.id` real, así que la fila se
 * guarda bajo el slug del negocio en vez del UUID.
 *
 * Igual que el resto de adaptadores JSON del repo: el incremento es
 * leer-sumar-escribir, no atómico bajo concurrencia. Suficiente para
 * desarrollo de un solo proceso; la garantía real (sin condición de carrera)
 * vive en `registrar_uso_ia` del lado de Supabase (migración 0005).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AiUsageEntry, AiUsageRepository } from "@/core/storage/usage-repository";

interface StoredCounters {
  llamadas: number;
  tokensIn: number;
  tokensOut: number;
  fallbacks: number;
}

/** Ruta por defecto del archivo (gitignorado, igual que `data/leads.json`). */
export function defaultUsageFile(): string {
  return process.env.AI_USAGE_FILE ?? join(process.cwd(), "data", "uso-ia.json");
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export class JsonAiUsageRepository implements AiUsageRepository {
  constructor(private readonly filePath: string = defaultUsageFile()) {}

  private async readAll(): Promise<Record<string, StoredCounters>> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredCounters>) : {};
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  private async writeAll(map: Record<string, StoredCounters>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(map, null, 2), "utf8");
  }

  async registrar(entry: AiUsageEntry): Promise<void> {
    const key = `${entry.negocio}|${hoyISO()}|${entry.proveedor}`;
    const map = await this.readAll();
    const actual: StoredCounters = map[key] ?? {
      llamadas: 0,
      tokensIn: 0,
      tokensOut: 0,
      fallbacks: 0,
    };
    map[key] = {
      llamadas: actual.llamadas + (entry.llamadas ?? 0),
      tokensIn: actual.tokensIn + (entry.tokensIn ?? 0),
      tokensOut: actual.tokensOut + (entry.tokensOut ?? 0),
      fallbacks: actual.fallbacks + (entry.fallbacks ?? 0),
    };
    await this.writeAll(map);
  }
}
