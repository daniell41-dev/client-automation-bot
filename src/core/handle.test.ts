import { describe, expect, it } from "vitest";
import { handleIncoming } from "@/core/handle";
import type { BusinessConfig, IncomingMessage, Lead } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { ILLMProvider } from "@/core/ai/provider";
import { makeFakeCalendar } from "@/core/storage/adapters/google/fake-calendar";

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

/** LLM falso: enhance devuelve el borrador; extractDateTime es configurable. */
function fakeLLM(extracted: string | null = "2026-06-30T15:00:00-05:00"): ILLMProvider {
  return {
    async enhance(ctx) {
      return ctx.draftResponse;
    },
    async extractDateTime() {
      return extracted;
    },
  };
}

/** Lleva un lead nuevo hasta justo ANTES de confirmar (stage esperando_confirmacion). */
async function driveUntilConfirm(
  repo: LeadRepository,
  llm: ILLMProvider | undefined,
  calendar: Parameters<typeof handleIncoming>[6],
): Promise<void> {
  await handleIncoming(msg("limpieza facial"), config, repo, new Date(), llm, undefined, calendar);
  await handleIncoming(msg("Laura"), config, repo, new Date(), llm, undefined, calendar);
  await handleIncoming(msg("mañana a las 3"), config, repo, new Date(), llm, undefined, calendar);
}

describe("handleIncoming — agendar en calendario al confirmar", () => {
  it("crea un evento al confirmar la cita", async () => {
    const repo = new InMemoryRepo();
    const cal = makeFakeCalendar();
    await driveUntilConfirm(repo, fakeLLM(), cal);

    await handleIncoming(msg("sí"), config, repo, new Date(), fakeLLM(), undefined, cal);

    expect(cal.events).toHaveLength(1);
    expect(cal.events[0].summary).toBe("Limpieza facial - Laura");
    expect(cal.events[0].startISO).toBe("2026-06-30T15:00:00-05:00");
  });

  it("NO crea evento antes de la confirmación", async () => {
    const repo = new InMemoryRepo();
    const cal = makeFakeCalendar();
    await driveUntilConfirm(repo, fakeLLM(), cal);
    expect(cal.events).toHaveLength(0);
  });

  it("NO crea un segundo evento si el cliente escribe después de confirmar", async () => {
    const repo = new InMemoryRepo();
    const cal = makeFakeCalendar();
    await driveUntilConfirm(repo, fakeLLM(), cal);
    await handleIncoming(msg("sí"), config, repo, new Date(), fakeLLM(), undefined, cal);

    await handleIncoming(msg("gracias!"), config, repo, new Date(), fakeLLM(), undefined, cal);

    expect(cal.events).toHaveLength(1);
  });

  it("si la fecha es ambigua (null) no agenda, deja nota y NO rompe el flujo", async () => {
    const repo = new InMemoryRepo();
    const cal = makeFakeCalendar();
    await driveUntilConfirm(repo, fakeLLM(null), cal);

    const replies = await handleIncoming(
      msg("sí"), config, repo, new Date(), fakeLLM(null), undefined, cal,
    );

    expect(cal.events).toHaveLength(0);
    expect(replies.length).toBeGreaterThan(0); // el cliente igual recibe respuesta
    expect(repo.leads[0].notes).toMatch(/manualmente/i);
    expect(repo.leads[0].stage).toBe("datos_completos");
  });

  it("no toca el calendario si no se inyecta cliente de calendar", async () => {
    const repo = new InMemoryRepo();
    await driveUntilConfirm(repo, fakeLLM(), undefined);
    const replies = await handleIncoming(
      msg("sí"), config, repo, new Date(), fakeLLM(), undefined, undefined,
    );
    expect(replies.length).toBeGreaterThan(0);
    expect(repo.leads[0].stage).toBe("datos_completos");
  });
});
