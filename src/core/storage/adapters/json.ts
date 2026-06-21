/**
 * Adaptador de almacenamiento por archivo JSON.
 *
 * Default del MVP: cero setup, sin base de datos. Guarda todos los leads en un
 * único archivo JSON. Suficiente para un negocio pequeño y para el simulador.
 *
 * Para producción con volumen o multi-instancia conviene un adaptador de BD,
 * que solo necesita implementar `LeadRepository`.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Lead } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";

/** Ruta por defecto del archivo de datos (gitignored). */
export function defaultDataFile(): string {
  return process.env.LEADS_FILE ?? join(process.cwd(), "data", "leads.json");
}

export class JsonLeadRepository implements LeadRepository {
  constructor(private readonly filePath: string = defaultDataFile()) {}

  private async readAll(): Promise<Lead[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Lead[]) : [];
    } catch (err) {
      // Archivo aún inexistente → colección vacía.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  private async writeAll(leads: Lead[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(leads, null, 2), "utf8");
  }

  async findByContact(
    businessSlug: string,
    contact: string,
  ): Promise<Lead | null> {
    const leads = await this.readAll();
    return (
      leads.find(
        (l) => l.businessSlug === businessSlug && l.contact === contact,
      ) ?? null
    );
  }

  async getById(id: string): Promise<Lead | null> {
    const leads = await this.readAll();
    return leads.find((l) => l.id === id) ?? null;
  }

  async save(lead: Lead): Promise<Lead> {
    const leads = await this.readAll();
    const index = leads.findIndex((l) => l.id === lead.id);
    if (index >= 0) {
      leads[index] = lead;
    } else {
      leads.push(lead);
    }
    await this.writeAll(leads);
    return lead;
  }

  async list(businessSlug?: string): Promise<Lead[]> {
    const leads = await this.readAll();
    const filtered = businessSlug
      ? leads.filter((l) => l.businessSlug === businessSlug)
      : leads;
    return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
