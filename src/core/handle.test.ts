import { describe, expect, it } from "vitest";
import { handleIncoming } from "@/core/handle";
import type { BusinessConfig, IncomingMessage, Lead } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";

/** Repositorio en memoria para el test (implementa el contrato). */
class InMemoryRepo implements LeadRepository {
  leads: Lead[] = [];
  async findByContact(businessSlug: string, contact: string) {
    return (
      this.leads.find(
        (l) => l.businessSlug === businessSlug && l.contact === contact,
      ) ?? null
    );
  }
  async getById(id: string) {
    return this.leads.find((l) => l.id === id) ?? null;
  }
  async save(lead: Lead) {
    const i = this.leads.findIndex((l) => l.id === lead.id);
    if (i >= 0) this.leads[i] = lead;
    else this.leads.push(lead);
    return lead;
  }
  async list() {
    return this.leads;
  }
}

const config: BusinessConfig = {
  slug: "estetica-bella",
  name: "Estética Bella",
  currency: "COP",
  services: [
    {
      id: "limpieza-facial",
      name: "Limpieza facial",
      description: "x",
      price: 120000,
      durationMinutes: 60,
      keywords: ["facial", "limpieza"],
    },
  ],
  messages: {
    welcome: "¿Qué servicio?",
    askName: "¿Nombre?",
    askDate: "¿Fecha?",
    askConfirm: "¿Confirmas {{servicio}} para {{fecha}}?",
    serviceInfo: "{{servicio}} {{precio}}",
    captured: "Listo {{nombre}}",
    fallback: "no entendí",
  },
  followUps: [],
};

function msg(text: string): IncomingMessage {
  return {
    channel: "mock",
    businessSlug: "estetica-bella",
    from: "57300000000",
    text,
    timestamp: "2026-06-21T10:00:00.000Z",
  };
}

describe("handleIncoming", () => {
  it("crea un lead nuevo y devuelve respuestas", async () => {
    const repo = new InMemoryRepo();
    const out = await handleIncoming(msg("limpieza facial"), config, repo);
    expect(out.length).toBeGreaterThan(0);
    expect(repo.leads).toHaveLength(1);
    expect(repo.leads[0].serviceId).toBe("limpieza-facial");
  });

  it("reutiliza el lead existente en el siguiente mensaje", async () => {
    const repo = new InMemoryRepo();
    await handleIncoming(msg("limpieza facial"), config, repo); // → pide nombre
    await handleIncoming(msg("Laura"), config, repo); // → guarda nombre
    expect(repo.leads).toHaveLength(1);
    expect(repo.leads[0].name).toBe("Laura");
  });
});
