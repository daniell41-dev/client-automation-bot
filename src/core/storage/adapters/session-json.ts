/**
 * Adaptador de sesiones por archivo JSON.
 * Guarda un archivo por contacto en data/sessions/<businessSlug>/<contact>.json
 * La carpeta data/ está en .gitignore.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Channel, SessionMemory } from "@/core/types";
import type { SessionRepository } from "@/core/storage/session-repository";

/** Máximo de turnos que se conservan en el historial (sliding window). */
const MAX_HISTORY = 10;

export class SessionJsonRepository implements SessionRepository {
  constructor(
    private readonly baseDir: string = join(process.cwd(), "data", "sessions"),
  ) {}

  private filePath(businessSlug: string, contact: string): string {
    const safeName = contact.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.baseDir, businessSlug, `${safeName}.json`);
  }

  async getOrCreate(
    businessSlug: string,
    contact: string,
    channel: Channel,
  ): Promise<SessionMemory> {
    try {
      const raw = await readFile(this.filePath(businessSlug, contact), "utf8");
      return JSON.parse(raw) as SessionMemory;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          contact,
          businessSlug,
          channel,
          history: [],
          updatedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  async save(session: SessionMemory): Promise<void> {
    const trimmed: SessionMemory = {
      ...session,
      history: session.history.slice(-MAX_HISTORY),
      updatedAt: new Date().toISOString(),
    };
    const path = this.filePath(session.businessSlug, session.contact);
    await mkdir(join(this.baseDir, session.businessSlug), { recursive: true });
    await writeFile(path, JSON.stringify(trimmed, null, 2), "utf8");
  }
}
