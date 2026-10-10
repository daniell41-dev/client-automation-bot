/**
 * Medidor de WhatsApp por archivo JSON (fallback sin credenciales, mismo
 * criterio que `usage-json.ts`): leer-sumar-escribir, no atómico. La
 * garantía real vive en `registrar_uso_whatsapp` (migración 0021).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  mesDeUso,
  type WhatsAppUsageEntry,
  type WhatsAppUsageRepository,
} from "@/core/storage/whatsapp-usage-repository";

interface Contadores {
  recibidos: number;
  enviados: number;
  plantillas: number;
}

/** Ruta por defecto del archivo (gitignorado, igual que `data/leads.json`). */
export function defaultWhatsAppUsageFile(): string {
  return process.env.WHATSAPP_USAGE_FILE ?? join(process.cwd(), "data", "uso-whatsapp.json");
}

export class JsonWhatsAppUsageRepository implements WhatsAppUsageRepository {
  constructor(
    private readonly filePath: string = defaultWhatsAppUsageFile(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async readAll(): Promise<Record<string, Contadores>> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      return parsed && typeof parsed === "object" ? (parsed as Record<string, Contadores>) : {};
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  async registrar(entry: WhatsAppUsageEntry): Promise<void> {
    const key = `${entry.negocio}|${mesDeUso(this.now())}`;
    const map = await this.readAll();
    const actual = map[key] ?? { recibidos: 0, enviados: 0, plantillas: 0 };
    map[key] = {
      recibidos: actual.recibidos + (entry.recibidos ?? 0),
      enviados: actual.enviados + (entry.enviados ?? 0),
      plantillas: actual.plantillas + (entry.plantillas ?? 0),
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(map, null, 2), "utf8");
  }
}
