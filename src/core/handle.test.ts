import { describe, expect, it } from "vitest";
import { handleIncoming, handleOwnerApproval } from "@/core/handle";
import type { BusinessConfig, DiaAtencion, IncomingMessage, Lead } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { InventoryRepository, StockItem, StockResult } from "@/core/storage/inventory-repository";
import type {
  Comprobante,
  ComprobanteRepository,
  NuevoComprobante,
} from "@/core/storage/comprobante-repository";
import type { AgentTurnInput, ILLMProvider } from "@/core/ai/provider";
import type { AgentResponse } from "@/core/ai/agent-schema";
import { makeFakeCalendar } from "@/core/storage/adapters/google/fake-calendar";
import { SessionMemoryRepository } from "@/core/storage/adapters/session-memory";

/** Inventario en memoria para tests: mismo algoritmo (validar todo, después descontar todo). */
class InMemoryInventory implements InventoryRepository {
  stock = new Map<string, number>();
  private key(negocio: string, serviceId: string): string {
    return `${negocio}|${serviceId}`;
  }
  async setStock(negocio: string, serviceId: string, stock: number): Promise<void> {
    this.stock.set(this.key(negocio, serviceId), stock);
  }
  async decrementCart(negocio: string, items: StockItem[]): Promise<StockResult> {
    const faltantes: string[] = [];
    for (const item of items) {
      const disponible = this.stock.get(this.key(negocio, item.serviceId));
      if (disponible !== undefined && disponible < item.cantidad) faltantes.push(item.serviceId);
    }
    if (faltantes.length > 0) return { ok: false, faltantes };
    for (const item of items) {
      const key = this.key(negocio, item.serviceId);
      const disponible = this.stock.get(key);
      if (disponible !== undefined) this.stock.set(key, disponible - item.cantidad);
    }
    return { ok: true };
  }
}

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

/**
 * `timestamp` por defecto es "ahora mismo" (igual que en producción, donde el
 * mensaje entrante llega y se procesa prácticamente en el mismo instante) —
 * no un valor fijo: desde que `handleIncoming` compara `lastInboundAt` contra
 * `now` (T-20, inactividad de 24h), un timestamp viejo fijo dispararía un
 * reseteo por "inactividad" falso en cualquier test que no pase su propio
 * `now`. Los tests que SÍ quieren simular una fecha puntual (p. ej. para
 * `extractDateTime`) pasan `now` explícito a `handleIncoming`, no acá.
 */
function msg(text: string): IncomingMessage {
  return {
    channel: "mock",
    businessSlug: "estetica-bella",
    from: "57300000000",
    text,
    timestamp: new Date().toISOString(),
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

  it("un saludo después de confirmar tampoco crea un segundo evento (T-20: bug de 'datos_completos')", async () => {
    // Antes del fix, "Hola" caía en el saludo genérico del motor determinista,
    // bajaba el stage a "menu_enviado" y — si el cliente volvía a confirmar —
    // se disparaba un segundo evento con una fecha vieja. Fechas explícitas
    // (no `driveUntilConfirm`/`new Date()`) para que quede claro que el
    // "Hola" llega el MISMO día de la cita — no se confunde con el cierre
    // automático por cita cumplida del PR 4.
    const repo = new InMemoryRepo();
    const cal = makeFakeCalendar();
    const now = new Date("2026-06-29T10:00:00-05:00"); // un día antes de la cita
    await handleIncoming(msg("limpieza facial"), config, repo, now, fakeLLM(), undefined, cal);
    await handleIncoming(msg("Laura"), config, repo, now, fakeLLM(), undefined, cal);
    await handleIncoming(msg("mañana a las 3"), config, repo, now, fakeLLM(), undefined, cal);
    await handleIncoming(msg("sí"), config, repo, now, fakeLLM(), undefined, cal);
    expect(repo.leads[0].stage).toBe("datos_completos");

    // "Hola" llega el mismo día de la cita (2026-06-30), un rato después.
    await handleIncoming(
      msg("Hola"), config, repo, new Date("2026-06-30T16:00:00-05:00"), fakeLLM(), undefined, cal,
    );

    expect(repo.leads[0].stage).toBe("datos_completos"); // no retrocedió
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

describe("handleIncoming — confirmedAt (T-20)", () => {
  it("setea confirmedAt al confirmar, incluso sin calendar", async () => {
    const repo = new InMemoryRepo();
    const now = new Date("2026-06-25T12:00:00.000Z");
    await driveUntilConfirm(repo, fakeLLM(), undefined);
    await handleIncoming(msg("sí"), config, repo, now, fakeLLM(), undefined, undefined);

    expect(repo.leads[0].confirmedAt).toBe(now.toISOString());
  });

  it("setea confirmedAt al confirmar incluso SIN ninguna IA (negocio 100% guiado)", async () => {
    const repo = new InMemoryRepo();
    const now = new Date("2026-06-25T12:00:00.000Z");
    // Sin llm: driveUntilConfirm con undefined corre el motor determinista puro.
    await handleIncoming(msg("limpieza facial"), config, repo, now);
    await handleIncoming(msg("Laura"), config, repo, now);
    await handleIncoming(msg("mañana a las 3"), config, repo, now);
    await handleIncoming(msg("sí"), config, repo, now);

    expect(repo.leads[0].stage).toBe("datos_completos");
    expect(repo.leads[0].confirmedAt).toBe(now.toISOString());
    // Sin IA no hay forma de resolver una fecha exacta.
    expect(repo.leads[0].appointmentAt).toBeUndefined();
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

const tiendaConNotify: BusinessConfig = {
  ...config,
  slug: "tienda",
  name: "Tienda Test",
  notifyPhoneNumber: "573009998888",
  catalogo: { modoPorDefecto: "pedido", etiqueta: { singular: "Producto", plural: "Productos" } },
  services: [
    { id: "harina", name: "Harina 1 Kg", description: "Harina pan", price: 5000, keywords: ["harina"] },
    { id: "aceite", name: "Aceite 1 Lt", description: "Aceite vegetal", price: 12000, keywords: ["aceite"] },
  ],
};

describe("handleIncoming — avisa a la dueña con el carrito completo (T-21)", () => {
  it("resume el pedido (varios productos + total) al pedir aprobación, en vez de 'Servicio: <uno>'", async () => {
    const repo = new InMemoryRepo();
    const notifier = fakeNotifier();
    await handleIncoming(msg("harina"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    await handleIncoming(msg("Laura"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    await handleIncoming(msg("2"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    await handleIncoming(msg("aceite"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    await handleIncoming(msg("1"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    await handleIncoming(msg("no, eso es todo"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);

    await handleIncoming(msg("sí"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].text).toContain("2x Harina 1 Kg");
    expect(notifier.sent[0].text).toContain("1x Aceite 1 Lt");
    expect(notifier.sent[0].text).toContain("Total");
    expect(notifier.sent[0].text).not.toContain("Servicio:");
    expect(notifier.sent[0].text).not.toContain("Fecha/hora:");
    // T-21/PR5: todavía NO está confirmado — recién lo está cuando la dueña responda.
    expect(notifier.sent[0].text).toContain("esperando tu aprobación");
    expect(notifier.sent[0].text).toContain("SÍ");

    expect(repo.leads[0].state).toBe("interesado");
    expect(repo.leads[0].stage).toBe("esperando_aprobacion");
  });
});

describe("handleIncoming — valida y descuenta stock al pedir aprobación (T-21, PR4+PR5)", () => {
  async function driveHastaConfirmar(
    repo: LeadRepository,
    inventory: InventoryRepository,
    notifier: ReturnType<typeof fakeNotifier>,
  ) {
    await handleIncoming(msg("harina"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
    await handleIncoming(msg("Laura"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
    await handleIncoming(msg("2"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
    await handleIncoming(msg("no, eso es todo"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
    return handleIncoming(msg("sí"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
  }

  it("con stock suficiente, descuenta y le pide aprobación a la dueña", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-1", "harina", 10);
    const notifier = fakeNotifier();

    const { messages } = await driveHastaConfirmar(repo, inventory, notifier);

    expect(repo.leads[0].state).toBe("interesado"); // todavía no "pagado"
    expect(repo.leads[0].stage).toBe("esperando_aprobacion");
    expect(messages[0].text).toContain("revisión");
    expect(inventory.stock.get("tienda-1|harina")).toBe(8); // 10 - 2, ya descontado
    expect(notifier.sent).toHaveLength(1); // sí se avisó a la dueña
  });

  it("sin stock suficiente, REVIERTE la confirmación y avisa qué falta", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-1", "harina", 1); // pide 2, solo hay 1
    const notifier = fakeNotifier();

    const { messages } = await driveHastaConfirmar(repo, inventory, notifier);

    expect(repo.leads[0].state).not.toBe("pagado");
    expect(repo.leads[0].stage).toBe("carrito_abierto"); // vuelve al carrito, no queda a medias
    expect(repo.leads[0].items).toEqual([{ serviceId: "harina", cantidad: 2 }]); // no se pierde el carrito
    expect(messages[0].text).toContain("Harina 1 Kg");
    expect(inventory.stock.get("tienda-1|harina")).toBe(1); // NO se descontó nada
    expect(notifier.sent).toHaveLength(0); // nunca se le pide aprobación a la dueña por algo que no se puede cumplir
  });

  it("un producto sin stock configurado nunca bloquea la confirmación", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory(); // "harina" nunca se cargó
    const notifier = fakeNotifier();

    const { messages } = await driveHastaConfirmar(repo, inventory, notifier);

    expect(repo.leads[0].stage).toBe("esperando_aprobacion");
    expect(messages[0].text).toContain("revisión");
    expect(notifier.sent).toHaveLength(1);
  });

  it("sin repositorio de inventario (comportamiento de antes del PR4), pide aprobación sin validar nada", async () => {
    const repo = new InMemoryRepo();
    const notifier = fakeNotifier();

    let r = await handleIncoming(msg("harina"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    r = await handleIncoming(msg("Laura"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    r = await handleIncoming(msg("2"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    r = await handleIncoming(msg("no, eso es todo"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);
    r = await handleIncoming(msg("sí"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier);

    expect(r.messages[0].text).toContain("revisión");
    expect(repo.leads[0].stage).toBe("esperando_aprobacion");
  });
});

describe("handleOwnerApproval — la dueña acepta o rechaza por WhatsApp (T-21, PR5)", () => {
  function ownerMsg(text: string): IncomingMessage {
    return { channel: "whatsapp", businessSlug: "tienda", from: "573009998888", text, timestamp: new Date().toISOString() };
  }

  async function driveHastaAprobacion(repo: LeadRepository): Promise<void> {
    await handleIncoming(msg("harina"), tiendaConNotify, repo);
    await handleIncoming(msg("Laura"), tiendaConNotify, repo);
    await handleIncoming(msg("2"), tiendaConNotify, repo);
    await handleIncoming(msg("no, eso es todo"), tiendaConNotify, repo);
    await handleIncoming(msg("sí"), tiendaConNotify, repo);
  }

  it("SÍ acepta el pedido: pasa a 'pagado', y el cliente recibe la confirmación", async () => {
    const repo = new InMemoryRepo();
    await driveHastaAprobacion(repo);
    expect(repo.leads[0].stage).toBe("esperando_aprobacion");

    const { ownerReply, customerReply } = await handleOwnerApproval(ownerMsg("sí"), tiendaConNotify, repo);

    expect(ownerReply.text).toContain("Laura");
    expect(customerReply?.to).toBe("57300000000");
    expect(customerReply?.text).toContain("2x Harina 1 Kg");
    expect(customerReply?.text).toContain("confirmado");
    expect(repo.leads[0].state).toBe("pagado");
    expect(repo.leads[0].stage).toBe("datos_completos");
    expect(repo.leads[0].confirmedAt).toBeDefined();
  });

  it("NO rechaza el pedido: pasa a 'perdido', y el cliente recibe el aviso de rechazo", async () => {
    const repo = new InMemoryRepo();
    await driveHastaAprobacion(repo);

    const { ownerReply, customerReply } = await handleOwnerApproval(ownerMsg("no"), tiendaConNotify, repo);

    expect(ownerReply.text).toContain("rechazado");
    expect(customerReply?.to).toBe("57300000000");
    expect(customerReply?.text).toContain("Laura");
    expect(repo.leads[0].state).toBe("perdido");
    expect(repo.leads[0].stage).toBe("inicio"); // muere de una, no queda a medias
    expect(repo.leads[0].items).toBeUndefined();
  });

  it("una respuesta ambigua no acepta ni rechaza nada — pide que aclare", async () => {
    const repo = new InMemoryRepo();
    await driveHastaAprobacion(repo);

    const { ownerReply, customerReply } = await handleOwnerApproval(ownerMsg("quién es?"), tiendaConNotify, repo);

    expect(ownerReply.text).toMatch(/SÍ|NO/);
    expect(customerReply).toBeUndefined();
    expect(repo.leads[0].stage).toBe("esperando_aprobacion"); // no se tocó
  });

  it("sin ningún pedido pendiente, avisa que no hay nada que aprobar", async () => {
    const repo = new InMemoryRepo();
    const { ownerReply, customerReply } = await handleOwnerApproval(ownerMsg("sí"), tiendaConNotify, repo);

    expect(ownerReply.text).toContain("No hay ningún pedido pendiente");
    expect(customerReply).toBeUndefined();
  });

  it("con dos pedidos pendientes, resuelve el más viejo primero (FIFO)", async () => {
    const repo = new InMemoryRepo();
    await driveHastaAprobacion(repo); // Laura, contact 57300000000

    // Segundo cliente, pedido más nuevo.
    const msg2 = (text: string): IncomingMessage => ({
      channel: "mock",
      businessSlug: "tienda",
      from: "57300000001",
      text,
      timestamp: new Date().toISOString(),
    });
    await handleIncoming(msg2("harina"), tiendaConNotify, repo);
    await handleIncoming(msg2("Carlos"), tiendaConNotify, repo);
    await handleIncoming(msg2("1"), tiendaConNotify, repo);
    await handleIncoming(msg2("no"), tiendaConNotify, repo);
    await handleIncoming(msg2("sí"), tiendaConNotify, repo);

    expect(repo.leads.filter((l) => l.stage === "esperando_aprobacion")).toHaveLength(2);

    const { ownerReply } = await handleOwnerApproval(ownerMsg("sí"), tiendaConNotify, repo);
    expect(ownerReply.text).toContain("Laura"); // el primero en pedir, no Carlos

    const laura = repo.leads.find((l) => l.contact === "57300000000")!;
    const carlos = repo.leads.find((l) => l.contact === "57300000001")!;
    expect(laura.state).toBe("pagado");
    expect(carlos.stage).toBe("esperando_aprobacion"); // el segundo sigue esperando
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

describe("handleIncoming — validación de horario de atención (T-20)", () => {
  // fakeLLM() extrae siempre "2026-06-30T15:00:00-05:00" — martes 15:00 en Bogotá.
  const HORARIO_MARTES_ANGOSTO: DiaAtencion[] = [
    { dow: 2, abierto: true, tramos: [{ desde: "09:00", hasta: "13:00" }] },
  ];
  const HORARIO_MARTES_AMPLIO: DiaAtencion[] = [
    { dow: 2, abierto: true, tramos: [{ desde: "09:00", hasta: "19:00" }] },
  ];

  it("rechaza una fecha fuera de horario: no confirma, limpia la fecha y avisa la alternativa", async () => {
    const repo = new InMemoryRepo();
    const configConHorarios: BusinessConfig = { ...config, horarios: HORARIO_MARTES_ANGOSTO };
    await handleIncoming(msg("limpieza facial"), configConHorarios, repo, new Date(), fakeLLM());
    await handleIncoming(msg("Laura"), configConHorarios, repo, new Date(), fakeLLM());

    const { messages } = await handleIncoming(
      msg("mañana a las 3"), configConHorarios, repo, new Date(), fakeLLM(),
    );

    expect(repo.leads[0].stage).toBe("esperando_fecha");
    expect(repo.leads[0].tentativeDate).toBeUndefined();
    expect(repo.leads[0].appointmentAt).toBeUndefined();
    expect(messages[0].text).toMatch(/martes/i);
  });

  it("acepta una fecha dentro del horario: confirma normalmente y persiste appointmentAt", async () => {
    const repo = new InMemoryRepo();
    const configConHorarios: BusinessConfig = { ...config, horarios: HORARIO_MARTES_AMPLIO };
    await handleIncoming(msg("limpieza facial"), configConHorarios, repo, new Date(), fakeLLM());
    await handleIncoming(msg("Laura"), configConHorarios, repo, new Date(), fakeLLM());
    await handleIncoming(msg("mañana a las 3"), configConHorarios, repo, new Date(), fakeLLM());

    expect(repo.leads[0].stage).toBe("esperando_confirmacion");
    expect(repo.leads[0].appointmentAt).toBe("2026-06-30T15:00:00-05:00");
  });

  it("sin IA no valida nada (no hay forma de resolver la fecha a ISO) — comportamiento igual a antes de T-20", async () => {
    const repo = new InMemoryRepo();
    const configConHorarios: BusinessConfig = { ...config, horarios: HORARIO_MARTES_ANGOSTO };
    await handleIncoming(msg("limpieza facial"), configConHorarios, repo);
    await handleIncoming(msg("Laura"), configConHorarios, repo);
    await handleIncoming(msg("mañana a las 3"), configConHorarios, repo);

    expect(repo.leads[0].stage).toBe("esperando_confirmacion");
    expect(repo.leads[0].appointmentAt).toBeUndefined();
  });

  it("sin horarios cargados, cualquier fecha se acepta (comportamiento igual a antes de T-20)", async () => {
    const repo = new InMemoryRepo();
    await handleIncoming(msg("limpieza facial"), config, repo, new Date(), fakeLLM());
    await handleIncoming(msg("Laura"), config, repo, new Date(), fakeLLM());
    await handleIncoming(msg("mañana a las 3"), config, repo, new Date(), fakeLLM());

    expect(repo.leads[0].stage).toBe("esperando_confirmacion");
    expect(repo.leads[0].appointmentAt).toBe("2026-06-30T15:00:00-05:00");
  });
});

describe("handleIncoming — cierre automático de la cita cumplida (T-20)", () => {
  it("un lead con cita de la semana pasada sale en recurrente/inicio y NO crea un segundo evento", async () => {
    const repo = new InMemoryRepo();
    const cal = makeFakeCalendar();
    await driveUntilConfirm(repo, fakeLLM(), cal);
    await handleIncoming(msg("sí"), config, repo, new Date("2026-06-23T10:00:00.000Z"), fakeLLM(), undefined, cal);
    expect(cal.events).toHaveLength(1);
    // La cita quedó para "2026-06-30T15:00:00-05:00" (fakeLLM). Un mensaje
    // varios días después de esa fecha debe encontrar la cita ya cumplida.
    const muchoDespues = new Date("2026-07-10T10:00:00.000Z");

    const { messages: replies } = await handleIncoming(msg("Hola"), config, repo, muchoDespues, fakeLLM(), undefined, cal);

    expect(repo.leads).toHaveLength(1);
    // El cierre pasa ANTES de procesar el mensaje: el lead entra a "Hola" ya
    // en recurrente/inicio, y el motor determinista lo lleva de ahí al menú
    // normal (igual que a cualquier lead nuevo) — no se queda pegado a la
    // cita vieja.
    expect(repo.leads[0].state).toBe("recurrente");
    expect(repo.leads[0].stage).toBe("menu_enviado");
    expect(repo.leads[0].name).toBe("Laura"); // se conserva: es un cliente que vuelve
    expect(repo.leads[0].appointmentAt).toBeUndefined();
    expect(cal.events).toHaveLength(1); // ningún evento nuevo por el "Hola"
    expect(replies.length).toBeGreaterThan(0);
  });

  it("una cita confirmada el mismo día NO se cierra (todavía no pasó el fin del día de la cita)", async () => {
    const repo = new InMemoryRepo();
    await driveUntilConfirm(repo, fakeLLM(), undefined);
    await handleIncoming(msg("sí"), config, repo, new Date("2026-06-30T10:00:00-05:00"), fakeLLM());

    await handleIncoming(msg("gracias!"), config, repo, new Date("2026-06-30T20:00:00-05:00"), fakeLLM());

    // Nota: no se afirma nada sobre `stage` acá — el bug ya documentado del
    // motor determinista con "datos_completos" (T-20, PR 6) es un problema
    // aparte; lo que importa para PR 4 es que el cierre automático no
    // dispare de más el mismo día.
    expect(repo.leads[0].state).not.toBe("recurrente");
    expect(repo.leads[0].appointmentAt).toBe("2026-06-30T15:00:00-05:00");
  });
});

describe("handleIncoming — reinicio por inactividad (T-20)", () => {
  const configGuiadoConPersona: BusinessConfig = {
    ...config,
    personas: {
      whatsapp: { name: "Isabella", tone: "cálida", language: "español colombiano" },
    },
    // "guiado" explícito: así el turno pasa siempre por enhance()/sessionRepo,
    // sin depender de si el fake del agente decide usarse o no.
    ai: { enabled: true, modo: "guiado" },
  };

  function msgAt(text: string, timestamp: string): IncomingMessage {
    return {
      channel: "mock",
      businessSlug: "estetica-bella",
      from: "57300000000",
      text,
      timestamp,
    };
  }

  it("tras 25h de inactividad, un lead a medias vuelve a 'nuevo' y el hilo de charla arranca vacío", async () => {
    const repo = new InMemoryRepo();
    const sessionRepo = new SessionMemoryRepository();
    const t0 = new Date("2026-06-01T10:00:00.000Z");
    await handleIncoming(msgAt("limpieza facial", t0.toISOString()), configGuiadoConPersona, repo, t0, fakeLLM(), sessionRepo);
    await handleIncoming(msgAt("Laura", t0.toISOString()), configGuiadoConPersona, repo, t0, fakeLLM(), sessionRepo);
    expect(repo.leads[0].stage).toBe("esperando_fecha");
    expect(repo.leads[0].name).toBe("Laura");

    const t1 = new Date(t0.getTime() + 25 * 60 * 60 * 1000); // +25h: inactivo
    await handleIncoming(msgAt("Hola", t1.toISOString()), configGuiadoConPersona, repo, t1, fakeLLM(), sessionRepo);

    // Los datos capturados (nombre, servicio) se perdieron: el lead vuelve a
    // "nuevo" y el "Hola" lo lleva de ahí al menú normal, como a cualquiera.
    expect(repo.leads[0].name).toBeUndefined();
    expect(repo.leads[0].serviceId).toBeUndefined();
    expect(repo.leads[0].state).toBe("nuevo");

    // El hilo de charla arrancó vacío: solo quedan las 2 entradas de ESTE
    // turno (usuario + asistente), no las de los dos turnos previos.
    const session = await sessionRepo.getOrCreate("estetica-bella", "57300000000", "mock");
    expect(session.history).toHaveLength(2);
    expect(session.history[0]).toMatchObject({ role: "user", text: "Hola" });
  });

  it("una cita futura confirmada NO se toca aunque pasen 25h sin que el cliente escriba", async () => {
    const repo = new InMemoryRepo();
    const t0 = new Date("2026-06-20T10:00:00.000Z"); // bien antes de la cita (2026-06-30)
    await handleIncoming(msgAt("limpieza facial", t0.toISOString()), config, repo, t0, fakeLLM());
    await handleIncoming(msgAt("Laura", t0.toISOString()), config, repo, t0, fakeLLM());
    await handleIncoming(msgAt("mañana a las 3", t0.toISOString()), config, repo, t0, fakeLLM());
    await handleIncoming(msgAt("sí", t0.toISOString()), config, repo, t0, fakeLLM());
    expect(repo.leads[0].stage).toBe("datos_completos");

    const t1 = new Date(t0.getTime() + 25 * 60 * 60 * 1000); // +25h, sigue antes de la cita
    await handleIncoming(msgAt("gracias!", t1.toISOString()), config, repo, t1, fakeLLM());

    expect(repo.leads[0].stage).toBe("datos_completos");
    expect(repo.leads[0].name).toBe("Laura");
    expect(repo.leads[0].appointmentAt).toBe("2026-06-30T15:00:00-05:00");
  });
});

describe("handleIncoming — visión por imagen (T-23.5)", () => {
  const repuestos: BusinessConfig = {
    ...config,
    slug: "taller",
    services: [
      {
        id: "filtro-toyota",
        name: "Filtro de aceite Toyota",
        description: "Referencia FA-2201",
        price: 45000,
        keywords: ["fa-2201"],
      },
      {
        id: "filtro-mazda",
        name: "Filtro de aire Mazda",
        description: "Referencia FR-100",
        price: 38000,
        categoria: "Filtros",
        keywords: ["fr-100"],
      },
      {
        id: "otro-filtro",
        name: "Filtro de combustible",
        description: "x",
        price: 30000,
        categoria: "Filtros",
        keywords: ["fc-900"],
      },
    ],
  };

  const farmacia: BusinessConfig = {
    ...config,
    slug: "farmacia",
    rubro: "Farmacia",
    services: [
      { id: "acetaminofen", name: "Acetaminofén MK 500mg", description: "x", price: 8000, keywords: ["acetaminofen"] },
    ],
  };

  function imageMsg(businessSlug: string, caption = ""): IncomingMessage {
    return {
      channel: "whatsapp",
      businessSlug,
      from: "57300000000",
      text: caption,
      timestamp: new Date().toISOString(),
      image: { mediaId: "media-1", mimeType: "image/jpeg" },
    };
  }

  function fakeVisionLLM(descripcion: Awaited<ReturnType<NonNullable<ILLMProvider["describeImage"]>>>): ILLMProvider {
    return {
      supportsVision: true,
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent() {
        return null;
      },
      async describeImage() {
        return descripcion;
      },
    };
  }

  const media = { base64: "QUJDMTIzQkFTRTY0", mimeType: "image/jpeg" };
  const fakeMediaDownloader = () => async () => media;

  it("1 candidato (match exacto por referencia): afirma el producto y el precio", async () => {
    const repo = new InMemoryRepo();
    const llm = fakeVisionLLM({
      tipoProducto: "filtro",
      textoVisible: ["FA-2201"],
      esRecipeMedico: false,
      confianza: "alta",
    });
    const { messages } = await handleIncoming(
      imageMsg("taller"),
      repuestos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      fakeMediaDownloader(),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain("Filtro de aceite Toyota");
    expect(messages[0].text).toContain("45.000");
  });

  it("2-3 candidatos (solo categoría): propone las opciones y pregunta", async () => {
    const repo = new InMemoryRepo();
    const llm = fakeVisionLLM({
      tipoProducto: "filtro",
      textoVisible: [],
      categoria: "Filtros",
      esRecipeMedico: false,
      confianza: "media",
    });
    const { messages } = await handleIncoming(
      imageMsg("taller"),
      repuestos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      fakeMediaDownloader(),
    );
    expect(messages[0].text).toContain("Filtro de aire Mazda");
    expect(messages[0].text).toContain("Filtro de combustible");
    expect(messages[0].text).not.toContain("Filtro de aceite Toyota"); // no matchea esa categoría/ref
  });

  it("0 candidatos: pide el nombre o la referencia por texto, nunca inventa un producto", async () => {
    const repo = new InMemoryRepo();
    const llm = fakeVisionLLM({
      tipoProducto: "algo que no existe en el catálogo",
      textoVisible: [],
      esRecipeMedico: false,
      confianza: "baja",
    });
    const { messages } = await handleIncoming(
      imageMsg("taller"),
      repuestos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      fakeMediaDownloader(),
    );
    expect(messages[0].text.toLowerCase()).toMatch(/nombre|referencia/);
    for (const s of repuestos.services) {
      expect(messages[0].text).not.toContain(s.name);
    }
  });

  it("récipe médico en rubro farmacéutico: rechaza y NUNCA busca el producto (§1.4, regla dura)", async () => {
    const repo = new InMemoryRepo();
    const llm = fakeVisionLLM({
      tipoProducto: "fórmula médica",
      textoVisible: ["Acetaminofén 500mg"],
      esRecipeMedico: true,
      confianza: "alta",
    });
    const { messages } = await handleIncoming(
      imageMsg("farmacia"),
      farmacia,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      fakeMediaDownloader(),
    );
    expect(messages[0].text).toMatch(/en persona|farmacia/i);
    expect(messages[0].text).not.toContain("Acetaminofén MK");
  });

  it("un récipe en un rubro que NO es farmacéutico sí se procesa normalmente", async () => {
    const repo = new InMemoryRepo();
    const llm = fakeVisionLLM({
      tipoProducto: "filtro",
      textoVisible: ["FA-2201"],
      esRecipeMedico: true, // el modelo lo marca, pero el negocio no es farmacia
      confianza: "alta",
    });
    const { messages } = await handleIncoming(
      imageMsg("taller"),
      repuestos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      fakeMediaDownloader(),
    );
    expect(messages[0].text).toContain("Filtro de aceite Toyota");
  });

  it("si no se puede descargar la imagen, cae al mensaje de respaldo sin romper la charla", async () => {
    const repo = new InMemoryRepo();
    const llm = fakeVisionLLM({
      tipoProducto: "x",
      textoVisible: [],
      esRecipeMedico: false,
      confianza: "baja",
    });
    const { messages } = await handleIncoming(
      imageMsg("taller"),
      repuestos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      async () => null,
    );
    expect(messages[0].text).toMatch(/no pude ver/i);
  });

  it("si describeImage devuelve null (JSON inválido), cae al mensaje de respaldo", async () => {
    const repo = new InMemoryRepo();
    const llm = fakeVisionLLM(null);
    const { messages } = await handleIncoming(
      imageMsg("taller"),
      repuestos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      fakeMediaDownloader(),
    );
    expect(messages[0].text).toMatch(/no pude ver/i);
  });

  it("sin llm o sin mediaDownloader, cae al mensaje de respaldo (nunca revienta)", async () => {
    const repo = new InMemoryRepo();
    const sinLlm = await handleIncoming(imageMsg("taller"), repuestos, repo, new Date());
    expect(sinLlm.messages[0].text).toMatch(/no pude ver/i);

    const sinDownloader = await handleIncoming(
      imageMsg("taller"),
      repuestos,
      repo,
      new Date(),
      fakeVisionLLM({ tipoProducto: "x", textoVisible: [], esRecipeMedico: false, confianza: "alta" }),
    );
    expect(sinDownloader.messages[0].text).toMatch(/no pude ver/i);
  });

  it("nunca persiste la imagen: ni en el lead ni en el historial de sesión, solo texto", async () => {
    const repo = new InMemoryRepo();
    const sessionRepo = new SessionMemoryRepository();
    const llm = fakeVisionLLM({
      tipoProducto: "filtro",
      marca: "Toyota",
      textoVisible: ["FA-2201"],
      esRecipeMedico: false,
      confianza: "alta",
    });
    await handleIncoming(
      imageMsg("taller"),
      repuestos,
      repo,
      new Date(),
      llm,
      sessionRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      fakeMediaDownloader(),
    );

    // El repo de leads ni se toca: una imagen no crea/actualiza un lead por sí sola.
    expect(repo.leads).toHaveLength(0);

    // El historial de sesión queda en texto — nunca el base64 de la imagen.
    const session = await sessionRepo.getOrCreate("taller", "57300000000", "whatsapp");
    expect(session.history).toHaveLength(2);
    expect(session.history[0].text).toBe("[imagen] Toyota filtro");
    expect(session.history[0].text).not.toContain(media.base64);
    expect(session.history[1].text).not.toContain(media.base64);
    expect(JSON.stringify(session.history)).not.toContain(media.base64);
  });
});

describe("handleIncoming — confirmación de pago con comprobante (T-24.4)", () => {
  class InMemoryComprobantes implements ComprobanteRepository {
    comprobantes: Comprobante[] = [];
    async crear(nuevo: NuevoComprobante): Promise<Comprobante> {
      if (
        nuevo.referencia &&
        this.comprobantes.some((c) => c.negocio === nuevo.negocio && c.referencia === nuevo.referencia)
      ) {
        throw new Error(`referencia repetida: ${nuevo.referencia}`);
      }
      const comprobante: Comprobante = {
        ...nuevo,
        id: `c-${this.comprobantes.length + 1}`,
        estado: "pendiente",
        creadoEn: new Date().toISOString(),
      };
      this.comprobantes.push(comprobante);
      return comprobante;
    }
    async listar(negocio: string): Promise<Comprobante[]> {
      return this.comprobantes.filter((c) => c.negocio === negocio);
    }
  }

  const tiendaConPagos: BusinessConfig = {
    ...tiendaConNotify,
    slug: "tienda-pagos",
    pagos: { requiereComprobante: true, telefonoDestino: "3001112233" },
  };

  function fakePaymentLLM(
    receipt: Awaited<ReturnType<NonNullable<ILLMProvider["describePaymentReceipt"]>>>,
  ): ILLMProvider {
    return {
      supportsVision: true,
      async enhance(ctx) {
        return ctx.draftResponse;
      },
      async extractDateTime() {
        return null;
      },
      async interpret() {
        return null;
      },
      async runAgent() {
        return null;
      },
      async describePaymentReceipt() {
        return receipt;
      },
    };
  }

  const media = { base64: "UkVDSUJPMTIz", mimeType: "image/jpeg" };
  const fakeMediaDownloader = () => async () => media;

  function paymentMsg(): IncomingMessage {
    return {
      channel: "whatsapp",
      // Mismo businessSlug que usa msg() — es la clave con la que InMemoryRepo
      // encuentra el lead que se armó con los mensajes de texto anteriores.
      businessSlug: "estetica-bella",
      from: "57300000000",
      text: "",
      timestamp: new Date().toISOString(),
      image: { mediaId: "media-1", mimeType: "image/jpeg" },
    };
  }

  async function driveHastaEsperandoComprobante(
    repo: LeadRepository,
    inventory: InventoryRepository,
    notifier: ReturnType<typeof fakeNotifier>,
  ) {
    await handleIncoming(msg("harina"), tiendaConPagos, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-pagos-1");
    await handleIncoming(msg("Laura"), tiendaConPagos, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-pagos-1");
    await handleIncoming(msg("2"), tiendaConPagos, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-pagos-1");
    await handleIncoming(msg("no, eso es todo"), tiendaConPagos, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-pagos-1");
    return handleIncoming(msg("sí"), tiendaConPagos, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-pagos-1");
  }

  it("al confirmar el pedido, pide el comprobante en vez de avisar a la dueña de una — y ya descontó el stock", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-pagos-1", "harina", 10);
    const notifier = fakeNotifier();

    const { messages } = await driveHastaEsperandoComprobante(repo, inventory, notifier);

    expect(repo.leads[0].stage).toBe("esperando_aprobacion");
    expect(messages[0].text.toLowerCase()).toMatch(/comprobante/);
    expect(notifier.sent).toHaveLength(0); // todavía NO se avisó a la dueña
    expect(inventory.stock.get("tienda-pagos-1|harina")).toBe(8); // ya descontado, antes de cualquier comprobante
  });

  it("con el comprobante legible, avisa a la dueña con el resumen + señales y nunca le confirma el pago al cliente", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-pagos-1", "harina", 10);
    const notifier = fakeNotifier();
    const comprobantes = new InMemoryComprobantes();
    await driveHastaEsperandoComprobante(repo, inventory, notifier);

    const llm = fakePaymentLLM({
      banco: "nequi",
      referencia: "M12345678",
      monto: 10000,
      moneda: "COP",
      legible: "completo",
    });
    const { messages } = await handleIncoming(
      paymentMsg(),
      tiendaConPagos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      notifier,
      inventory,
      "tienda-pagos-1",
      fakeMediaDownloader(),
      comprobantes,
    );

    // Al cliente: nunca "confirmado"/"recibido tu pago" — solo que se lo pasamos a la dueña.
    expect(messages[0].text.toLowerCase()).not.toMatch(/confirmad|pago recibido/);
    expect(messages[0].text.toLowerCase()).toMatch(/se lo pas/);

    // A la dueña: si le llegó el aviso con los datos del comprobante.
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].text).toContain("nequi");
    expect(notifier.sent[0].text).toContain("M12345678");
    expect(notifier.sent[0].text).toContain("Respondé SÍ para aceptarlo o NO para rechazarlo.");

    // El comprobante quedó guardado.
    expect(comprobantes.comprobantes).toHaveLength(1);
    expect(comprobantes.comprobantes[0].referencia).toBe("M12345678");
  });

  it("una referencia repetida dispara la señal de riesgo en el aviso a la dueña", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-pagos-1", "harina", 100);
    const notifier = fakeNotifier();
    const comprobantes = new InMemoryComprobantes();
    // Ya existe un comprobante previo con la misma referencia en este negocio.
    await comprobantes.crear({ negocio: "tienda-pagos-1", referencia: "DUPLICADA" });

    await driveHastaEsperandoComprobante(repo, inventory, notifier);
    const llm = fakePaymentLLM({ banco: "nequi", referencia: "DUPLICADA", monto: 10000, legible: "completo" });

    await handleIncoming(
      paymentMsg(),
      tiendaConPagos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      notifier,
      inventory,
      "tienda-pagos-1",
      fakeMediaDownloader(),
      comprobantes,
    );

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].text).toMatch(/ya se usó|referencia/i);
  });

  it("un comprobante ilegible pide que lo reenvíen, sin avisar a la dueña", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-pagos-1", "harina", 10);
    const notifier = fakeNotifier();
    const comprobantes = new InMemoryComprobantes();
    await driveHastaEsperandoComprobante(repo, inventory, notifier);

    const llm = fakePaymentLLM({ legible: "ilegible" });
    const { messages } = await handleIncoming(
      paymentMsg(),
      tiendaConPagos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      notifier,
      inventory,
      "tienda-pagos-1",
      fakeMediaDownloader(),
      comprobantes,
    );

    expect(messages[0].text.toLowerCase()).toMatch(/no pude leer|reenv/);
    expect(notifier.sent).toHaveLength(0);
    expect(comprobantes.comprobantes).toHaveLength(0);
  });

  it("el SÍ de la dueña confirma el pedido sin volver a tocar el stock (handleOwnerApproval sin cambios)", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-pagos-1", "harina", 10);
    const notifier = fakeNotifier();
    const comprobantes = new InMemoryComprobantes();
    await driveHastaEsperandoComprobante(repo, inventory, notifier);
    const llm = fakePaymentLLM({ banco: "nequi", referencia: "OK-1", monto: 10000, legible: "completo" });
    await handleIncoming(
      paymentMsg(),
      tiendaConPagos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      notifier,
      inventory,
      "tienda-pagos-1",
      fakeMediaDownloader(),
      comprobantes,
    );
    const stockTrasComprobante = inventory.stock.get("tienda-pagos-1|harina");

    const ownerMsg: IncomingMessage = {
      channel: "whatsapp",
      businessSlug: "tienda-pagos",
      from: "573009998888",
      text: "sí",
      timestamp: new Date().toISOString(),
    };
    const { customerReply } = await handleOwnerApproval(ownerMsg, tiendaConPagos, repo);

    expect(repo.leads[0].stage).toBe("datos_completos");
    expect(repo.leads[0].state).toBe("pagado");
    expect(customerReply?.text.toLowerCase()).toMatch(/confirmad/);
    expect(inventory.stock.get("tienda-pagos-1|harina")).toBe(stockTrasComprobante); // no se tocó de nuevo
  });

  it("el NO de la dueña rechaza el pedido igual que antes de T-24", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-pagos-1", "harina", 10);
    const notifier = fakeNotifier();
    const comprobantes = new InMemoryComprobantes();
    await driveHastaEsperandoComprobante(repo, inventory, notifier);
    const llm = fakePaymentLLM({ banco: "nequi", referencia: "RECH-1", monto: 10000, legible: "completo" });
    await handleIncoming(
      paymentMsg(),
      tiendaConPagos,
      repo,
      new Date(),
      llm,
      undefined,
      undefined,
      notifier,
      inventory,
      "tienda-pagos-1",
      fakeMediaDownloader(),
      comprobantes,
    );

    const ownerMsg: IncomingMessage = {
      channel: "whatsapp",
      businessSlug: "tienda-pagos",
      from: "573009998888",
      text: "no",
      timestamp: new Date().toISOString(),
    };
    const { customerReply } = await handleOwnerApproval(ownerMsg, tiendaConPagos, repo);

    expect(repo.leads[0].stage).toBe("inicio");
    expect(repo.leads[0].state).toBe("perdido");
    expect(customerReply?.text.toLowerCase()).toMatch(/no pudimos confirmar/);
  });

  it("sin config.pagos.requiereComprobante, el flujo de antes de T-24 sigue exactamente igual", async () => {
    const repo = new InMemoryRepo();
    const inventory = new InMemoryInventory();
    await inventory.setStock("tienda-1", "harina", 10);
    const notifier = fakeNotifier();

    await handleIncoming(msg("harina"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
    await handleIncoming(msg("Laura"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
    await handleIncoming(msg("2"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
    await handleIncoming(msg("no, eso es todo"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");
    const { messages } = await handleIncoming(msg("sí"), tiendaConNotify, repo, new Date(), undefined, undefined, undefined, notifier, inventory, "tienda-1");

    expect(messages[0].text).toContain("revisión"); // el texto de siempre, no el de pedir comprobante
    expect(notifier.sent).toHaveLength(1); // se avisó a la dueña de una, como siempre
    expect(notifier.sent[0].text).toContain("Respondé SÍ");
  });
});
