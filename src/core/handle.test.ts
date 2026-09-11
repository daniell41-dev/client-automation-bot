import { describe, expect, it } from "vitest";
import { handleIncoming } from "@/core/handle";
import type { BusinessConfig, IncomingMessage, Lead } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { AgentTurnInput, ILLMProvider } from "@/core/ai/provider";
import type { AgentResponse } from "@/core/ai/agent-schema";
import { makeFakeCalendar } from "@/core/storage/adapters/google/fake-calendar";
import { SessionMemoryRepository } from "@/core/storage/adapters/session-memory";

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
    const { messages: out } = await handleIncoming(msg("limpieza facial"), config, repo);
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

/**
 * LLM falso: enhance devuelve el borrador; extractDateTime e interpret son
 * configurables (por defecto interpret devuelve null: sin red de seguridad).
 */
function fakeLLM(
  extracted: string | null = "2026-06-30T15:00:00-05:00",
  interpreted: string | null = null,
): ILLMProvider {
  return {
    async enhance(ctx) {
      return ctx.draftResponse;
    },
    async extractDateTime() {
      return extracted;
    },
    async interpret() {
      return interpreted;
    },
    async runAgent() {
      return null; // los tests de handle.test.ts usan el motor determinista
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

    const { messages: replies } = await handleIncoming(
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
    const { messages: replies } = await handleIncoming(
      msg("sí"), config, repo, new Date(), fakeLLM(), undefined, undefined,
    );
    expect(replies.length).toBeGreaterThan(0);
    expect(repo.leads[0].stage).toBe("datos_completos");
  });
});

/** Notifier falso: registra los mensajes enviados. */
function fakeNotifier(): { sent: { to: string; text: string }[]; send: (m: { to: string; text: string }) => Promise<void> } {
  const sent: { to: string; text: string }[] = [];
  return {
    sent,
    async send(m) {
      sent.push(m);
    },
  };
}

const configConNotify: BusinessConfig = {
  ...config,
  notifyPhoneNumber: "573009998888",
};

describe("handleIncoming — avisa a la dueña por WhatsApp al confirmar", () => {
  it("le envía un mensaje al notifyPhoneNumber cuando se confirma", async () => {
    const repo = new InMemoryRepo();
    const notifier = fakeNotifier();
    await handleIncoming(msg("limpieza facial"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);
    await handleIncoming(msg("Laura"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);
    await handleIncoming(msg("mañana a las 3"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);

    await handleIncoming(msg("sí"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].to).toBe("573009998888");
    expect(notifier.sent[0].text).toContain("Laura");
    expect(notifier.sent[0].text).toContain("Limpieza facial");
  });

  it("NO avisa si el negocio no configuró notifyPhoneNumber", async () => {
    const repo = new InMemoryRepo();
    const notifier = fakeNotifier();
    await handleIncoming(msg("limpieza facial"), config, repo, new Date(), fakeLLM(), undefined, undefined, notifier);
    await handleIncoming(msg("Laura"), config, repo, new Date(), fakeLLM(), undefined, undefined, notifier);
    await handleIncoming(msg("mañana a las 3"), config, repo, new Date(), fakeLLM(), undefined, undefined, notifier);
    await handleIncoming(msg("sí"), config, repo, new Date(), fakeLLM(), undefined, undefined, notifier);

    expect(notifier.sent).toHaveLength(0);
  });

  it("NO avisa una segunda vez si el cliente escribe después de confirmar", async () => {
    const repo = new InMemoryRepo();
    const notifier = fakeNotifier();
    await handleIncoming(msg("limpieza facial"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);
    await handleIncoming(msg("Laura"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);
    await handleIncoming(msg("mañana a las 3"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);
    await handleIncoming(msg("sí"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);

    await handleIncoming(msg("gracias!"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, notifier);

    expect(notifier.sent).toHaveLength(1);
  });

  it("no rompe la conversación si el envío de la notificación falla", async () => {
    const repo = new InMemoryRepo();
    const failingNotifier = {
      async send(): Promise<void> {
        throw new Error("network down");
      },
    };
    await handleIncoming(msg("limpieza facial"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, failingNotifier);
    await handleIncoming(msg("Laura"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, failingNotifier);
    await handleIncoming(msg("mañana a las 3"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, failingNotifier);

    const { messages: replies } = await handleIncoming(msg("sí"), configConNotify, repo, new Date(), fakeLLM(), undefined, undefined, failingNotifier);

    expect(replies.length).toBeGreaterThan(0);
    expect(repo.leads[0].stage).toBe("datos_completos");
  });
});

/** LLM falso configurable para probar la red de seguridad del intérprete. */
function fakeLLMWithInterpret(interpreted: string | null): {
  llm: ILLMProvider;
  state: { calls: number };
} {
  const state = { calls: 0 };
  const llm: ILLMProvider = {
    async enhance(ctx) {
      return ctx.draftResponse;
    },
    async extractDateTime() {
      return null;
    },
    async interpret() {
      state.calls++;
      return interpreted;
    },
    async runAgent() {
      return null;
    },
  };
  return { llm, state };
}

describe("handleIncoming — red de seguridad del intérprete IA", () => {
  it("usa la interpretación de la IA para reconocer un mensaje que el motor no entendió", async () => {
    const repo = new InMemoryRepo();
    const { llm, state } = fakeLLMWithInterpret("Limpieza facial");
    await handleIncoming(msg("Hola"), config, repo, new Date(), llm); // → menu_enviado

    const { messages: replies } = await handleIncoming(
      msg("necesito que me dejen la cara brillante"),
      config,
      repo,
      new Date(),
      llm,
    );

    expect(state.calls).toBe(1);
    expect(repo.leads[0].serviceId).toBe("limpieza-facial");
    expect(repo.leads[0].stage).toBe("esperando_nombre");
    expect(replies.length).toBeGreaterThan(0);
  });

  it("si la IA no reconoce nada (interpret null), se queda con el fallback normal", async () => {
    const repo = new InMemoryRepo();
    const { llm, state } = fakeLLMWithInterpret(null);
    await handleIncoming(msg("Hola"), config, repo, new Date(), llm);

    const { messages: replies } = await handleIncoming(msg("asdkjhaskjdh"), config, repo, new Date(), llm);

    expect(state.calls).toBe(1);
    expect(replies[0].text).toBe("no entendí");
  });

  it("sin IA no intenta interpretar y usa el fallback determinista", async () => {
    const repo = new InMemoryRepo();
    await handleIncoming(msg("Hola"), config, repo);

    const { messages: replies } = await handleIncoming(msg("asdkjhaskjdh"), config, repo);

    expect(replies[0].text).toBe("no entendí");
  });

  it("no llama a interpret cuando el motor sí entendió el mensaje", async () => {
    const repo = new InMemoryRepo();
    const { llm, state } = fakeLLMWithInterpret("Limpieza facial");

    await handleIncoming(msg("limpieza facial"), config, repo, new Date(), llm);

    expect(state.calls).toBe(0);
  });
});

describe("handleIncoming — modo agente", () => {
  const configConPersona: BusinessConfig = {
    ...config,
    personas: {
      whatsapp: { name: "Isabella", tone: "cálida", language: "español colombiano" },
    },
  };

  /**
   * LLM falso para el modo agente: cuenta cuántas veces se llama cada método.
   * `counts` es un objeto mutable (no getters) para que el conteo se pueda
   * leer DESPUÉS de esperar `handleIncoming` sin quedar pegado al valor de
   * cuando se creó el fake.
   */
  function fakeAgentLLM(
    runAgentImpl: (input: AgentTurnInput) => Promise<AgentResponse | null>,
  ): { llm: ILLMProvider; counts: { enhanceCalls: number; runAgentCalls: number } } {
    const counts = { enhanceCalls: 0, runAgentCalls: 0 };
    const llm: ILLMProvider = {
      async enhance(ctx) {
        counts.enhanceCalls++;
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return "2026-06-30T15:00:00-05:00";
      },
      async interpret() {
        return null;
      },
      async runAgent(input) {
        counts.runAgentCalls++;
        return runAgentImpl(input);
      },
    };
    return { llm, counts };
  }

  it("con persona + sessionRepo + IA, usa el agente y NO reformula con enhance()", async () => {
    const repo = new InMemoryRepo();
    const sessionRepo = new SessionMemoryRepository();
    const { llm, counts } = fakeAgentLLM(async () => ({
      respuesta: "¡Hola! ¿Qué servicio te interesa?",
      acciones: [],
    }));

    const { messages: replies, modo, motivoFallback } = await handleIncoming(
      msg("Hola"),
      configConPersona,
      repo,
      new Date(),
      llm,
      sessionRepo,
    );

    expect(counts.runAgentCalls).toBe(1);
    expect(counts.enhanceCalls).toBe(0);
    expect(replies[0].text).toBe("¡Hola! ¿Qué servicio te interesa?");
    expect(modo).toBe("agente");
    expect(motivoFallback).toBeUndefined();
  });

  it("sin sessionRepo, no usa el agente (cae al motor determinista puro, sin reformular)", async () => {
    // Igual que el modo guiado sin sessionRepo: ninguno de los dos puede
    // guardar historial, así que ninguno de los dos se ejecuta.
    const repo = new InMemoryRepo();
    const { llm, counts } = fakeAgentLLM(async () => ({
      respuesta: "no debería usarse",
      acciones: [],
    }));

    const { messages: replies, modo, motivoFallback } = await handleIncoming(
      msg("limpieza facial"),
      configConPersona,
      repo,
      new Date(),
      llm,
      undefined,
    );

    expect(counts.runAgentCalls).toBe(0);
    expect(counts.enhanceCalls).toBe(0);
    expect(replies[0].text).not.toBe("no debería usarse");
    expect(repo.leads[0].serviceId).toBe("limpieza-facial");
    expect(modo).toBe("guiado");
    expect(motivoFallback).toContain("faltan requisitos");
  });

  it("con modo 'guiado' explícito, no usa el agente aunque haya persona+IA+sessionRepo (no es un fallback)", async () => {
    const repo = new InMemoryRepo();
    const sessionRepo = new SessionMemoryRepository();
    const configGuiado: BusinessConfig = {
      ...configConPersona,
      ai: { enabled: true, modo: "guiado" },
    };
    const { llm, counts } = fakeAgentLLM(async () => ({ respuesta: "no debería usarse", acciones: [] }));

    const { messages: replies, modo, motivoFallback } = await handleIncoming(
      msg("limpieza facial"),
      configGuiado,
      repo,
      new Date(),
      llm,
      sessionRepo,
    );

    expect(counts.runAgentCalls).toBe(0);
    expect(replies[0].text).not.toBe("no debería usarse");
    // Guiado configurado a propósito: no es un fallback, así que no lleva motivo.
    expect(modo).toBe("guiado");
    expect(motivoFallback).toBeUndefined();
  });

  it("si el agente falla (runAgent lanza), cae al motor determinista y SÍ reformula con enhance()", async () => {
    const repo = new InMemoryRepo();
    const sessionRepo = new SessionMemoryRepository();
    const { llm, counts } = fakeAgentLLM(async () => {
      throw new Error("proveedor caído");
    });

    const { messages: replies, modo, motivoFallback } = await handleIncoming(
      msg("limpieza facial"),
      configConPersona,
      repo,
      new Date(),
      llm,
      sessionRepo,
    );

    expect(counts.enhanceCalls).toBeGreaterThan(0);
    expect(replies.length).toBeGreaterThan(0);
    expect(repo.leads[0].serviceId).toBe("limpieza-facial"); // el motor determinista sí lo reconoció
    expect(modo).toBe("guiado");
    expect(motivoFallback).toContain("no devolvió un turno válido");
  });

  it("al confirmar vía agente, agenda en el calendario y avisa a la dueña", async () => {
    const repo = new InMemoryRepo();
    const sessionRepo = new SessionMemoryRepository();
    const cal = makeFakeCalendar();
    const sent: { to: string; text: string }[] = [];
    const notifier = { async send(m: { to: string; text: string }) { sent.push(m); } };
    const configConNotifyYPersona: BusinessConfig = {
      ...configConPersona,
      notifyPhoneNumber: "573009998888",
    };

    const { llm } = fakeAgentLLM(async () => ({
      respuesta: "¡Listo Laura! Tu cita quedó agendada.",
      acciones: [
        { tipo: "elegir_servicio", servicioId: "limpieza-facial" },
        { tipo: "guardar_nombre", nombre: "Laura" },
        { tipo: "guardar_fecha", fecha: "mañana a las 3" },
        { tipo: "confirmar" },
      ],
    }));

    await handleIncoming(
      msg("quiero limpieza facial, soy Laura, mañana a las 3, confirmo"),
      configConNotifyYPersona,
      repo,
      new Date(),
      llm,
      sessionRepo,
      cal,
      notifier,
    );

    expect(repo.leads[0].stage).toBe("datos_completos");
    expect(cal.events).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("Laura");
  });

  it("persiste el historial de sesión (mensaje del cliente + respuesta del agente)", async () => {
    const repo = new InMemoryRepo();
    const sessionRepo = new SessionMemoryRepository();
    const { llm } = fakeAgentLLM(async () => ({
      respuesta: "¡Hola! ¿Qué servicio te interesa?",
      acciones: [],
    }));

    await handleIncoming(msg("Hola"), configConPersona, repo, new Date(), llm, sessionRepo);

    const session = await sessionRepo.getOrCreate("estetica-bella", "57300000000", "mock");
    expect(session.history).toHaveLength(2);
    expect(session.history[0]).toMatchObject({ role: "user", text: "Hola" });
    expect(session.history[1]).toMatchObject({
      role: "assistant",
      text: "¡Hola! ¿Qué servicio te interesa?",
    });
  });
});
