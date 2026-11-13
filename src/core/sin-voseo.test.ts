/**
 * T-78: red de seguridad contra el voseo. Nexo atiende negocios de Cúcuta y
 * un "¿Confirmás tu pedido?" hace que el producto parezca de otro país. Los
 * textos se arreglaron a mano; este test evita que vuelvan a colarse por un
 * mensaje nuevo, un default o el prompt (el modelo imita el registro del
 * prompt).
 *
 * Recorre lo que el bot REALMENTE manda (no el código fuente): un pedido
 * completo con comprobante, una cita, un rechazo con devolución y los
 * prompts de la IA, con las plantillas de rubro reales para que también
 * cuenten los textos de configuración.
 *
 * Lo que ESCRIBE el cliente no se revisa: si alguien escribe "querés", el
 * bot lo tiene que seguir entendiendo (ver `chat-spanish.ts`).
 */

import { describe, expect, it } from "vitest";
import { FALLBACK_AUDIO, handleIncoming, handleOwnerApproval } from "@/core/handle";
import {
  ASK_DIRECCION,
  DEFAULT_ASK_CONFIRM_PEDIDO,
  DEFAULT_PEDIDO_CONFIRMADO,
  DEFAULT_PEDIDO_RECHAZADO,
} from "@/core/engine/responder";
import { mensajeCodigoRetiro } from "@/core/engine/codigo-retiro";
import { mensajeCuentaRecibida, mensajeDevuelto, mensajePedirCuenta, avisoCuentaParaDueña } from "@/core/engine/devolucion";
import { mensajePedidoListo, validarEntrega } from "@/core/engine/panel-pedidos";
import { buildAgentSystemPrompt } from "@/core/ai/agent-prompt";
import { buildSystemPrompt } from "@/core/ai/prompt";
import { buildDateExtractionPrompt } from "@/core/ai/date-extraction";
import { buildInterpretPrompt } from "@/core/ai/interpret";
import { buildImageDescriptionPrompt } from "@/core/ai/image-prompt";
import { buildPaymentReceiptPrompt } from "@/core/ai/payment-receipt-prompt";
import { TRATO_AL_CLIENTE } from "@/core/ai/trato";
import type { AgentTurnInput, ILLMProvider } from "@/core/ai/provider";
import { RUBROS_BASE } from "@/businesses/rubros";
import { SupabasePedidoRepository } from "@/core/storage/adapters/supabase/pedidos";
import { makeFakeSupabaseDb } from "@/core/storage/adapters/supabase/fake-supabase";
import type { LeadRepository } from "@/core/storage/repository";
import type { BusinessConfig, IncomingMessage, Lead, OutgoingMessage } from "@/core/types";
import type { Pedido } from "@/core/storage/pedido-repository";

/** Las formas que pidió el dueño del producto, más las que aparecían en el repo antes de T-78. */
const FORMAS_PROHIBIDAS = [
  "vos", "sos", "tenés", "querés", "podés", "confirmás", "tocá", "respondé", "revisá", "escribí",
  "mandá", "elegí", "creá", "usá", "pedilo", "decinos", "contanos", "avisanos", "acá",
  // encontradas en el repo antes de T-78
  "necesitás", "buscás", "escribís", "reenviás", "recogés", "contame", "mandanos", "escribinos",
  "acordate", "mostralo", "mostrá", "tené", "revisalo", "revisalos", "entregalo", "aprobalo",
  "pagá", "hacé", "ajustá", "escaneá", "probá", "contactá", "disculpá", "reservá", "confirmá",
  "agregá", "celu",
];

const PATRON = new RegExp(`(?<![\\p{L}])(${FORMAS_PROHIBIDAS.join("|")})(?![\\p{L}])`, "giu");

/** Devuelve las formas de voseo encontradas en cada texto, para que el fallo diga dónde está. */
function voseoEn(textos: string[]): string[] {
  return textos.flatMap((t) => [...t.matchAll(PATRON)].map((m) => `"${m[0]}" en: ${t.slice(0, 120)}`));
}

function textosDe(salidas: (OutgoingMessage | undefined | null)[]): string[] {
  return salidas.flatMap((m) =>
    m
      ? [m.text, ...(m.options ?? []), ...(m.botones?.map((b) => b.titulo) ?? []), ...(m.plantillaParams ?? [])]
      : [],
  );
}

class RepoEnMemoria implements LeadRepository {
  leads: Lead[] = [];
  async findByContact(businessSlug: string, contact: string) {
    return this.leads.find((l) => l.businessSlug === businessSlug && l.contact === contact) ?? null;
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

function plantilla(slug: string): BusinessConfig {
  const rubro = RUBROS_BASE.find((r) => r.slug === slug)!;
  return { ...rubro.template, slug, notifyPhoneNumber: "573009998888", botActivo: true };
}

const CLIENTE = "57300000000";
const DUEÑA = "573009998888";

function delCliente(config: BusinessConfig, text: string): IncomingMessage {
  return { channel: "whatsapp", businessSlug: config.slug, from: CLIENTE, text, timestamp: new Date().toISOString() };
}

function deLaDueña(config: BusinessConfig, text: string, botonId: string): IncomingMessage {
  return { channel: "whatsapp", businessSlug: config.slug, from: DUEÑA, text, timestamp: new Date().toISOString(), botonId };
}

/** IA mínima: no reescribe nada (así se revisan los textos del motor tal cual) y lee el comprobante con el monto dado. */
function iaQueLee(monto: number): ILLMProvider {
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
      return { banco: "nequi", referencia: "M1", monto, moneda: "COP", legible: "completo" as const };
    },
  };
}

/** Pedido de restaurante a domicilio hasta que la dueña recibe el comprobante. */
async function pedidoConComprobante(montoPagado: number) {
  const config = { ...plantilla("restaurante"), pagos: { requiereComprobante: true } };
  const repo = new RepoEnMemoria();
  const db = makeFakeSupabaseDb();
  const pedidos = new SupabasePedidoRepository(db);
  const enviados: OutgoingMessage[] = [];
  const notifier = { async send(m: OutgoingMessage) { enviados.push(m); } };
  const ia = iaQueLee(montoPagado);
  const conversacion = ["hola", "bandeja paisa", "Laura", "2", "no, eso es todo", "Domicilio", "Calle 10 #5-20, barrio La Riviera", "sí"];
  for (const texto of conversacion) {
    const { messages } = await handleIncoming(
      delCliente(config, texto), config, repo, new Date(), ia, undefined, undefined, notifier,
      undefined, "neg-1", undefined, undefined, undefined, pedidos,
    );
    enviados.push(...messages);
  }
  const { messages } = await handleIncoming(
    { ...delCliente(config, ""), image: { mediaId: "m-1", mimeType: "image/jpeg" } },
    config, repo, new Date(), ia, undefined, undefined, notifier, undefined, "neg-1",
    async () => ({ base64: "eA==", mimeType: "image/jpeg" }), undefined, undefined, pedidos,
  );
  enviados.push(...messages);
  return { config, repo, db, pedidos, enviados };
}

describe("sin voseo en lo que lee una persona (T-78)", () => {
  it("un pedido completo: cliente y dueña, hasta la aprobación con código de retiro", async () => {
    const { config, repo, db, pedidos, enviados } = await pedidoConComprobante(56000 + 0);
    expect(db.pedidos).toHaveLength(1); // si el recorrido cambia, que el test lo diga en vez de revisar menos
    const { ownerReply, customerReply } = await handleOwnerApproval(
      deLaDueña(config, "Aprobar", `aprobar:${db.pedidos[0].id}`), config, repo, new Date(), pedidos, "neg-1",
    );
    expect(db.pedidos[0].estado).toBe("aprobado");

    const pedido = { numero: 1, modalidad: "Domicilio", estado: "aprobado", codigoRetiro: "4821" } as Pedido;
    const textos = [
      ...textosDe([...enviados, ownerReply, customerReply]),
      mensajeCodigoRetiro(1, "4821", "Domicilio"),
      mensajeCodigoRetiro(1, "4821", "Recoger en el local"),
      mensajePedidoListo(pedido),
      mensajePedidoListo({ ...pedido, modalidad: "Recoger en el local" }),
      (({ error }) => error)(validarEntrega(pedido, "0000") as { error?: string }) ?? "",
      DEFAULT_ASK_CONFIRM_PEDIDO,
      DEFAULT_PEDIDO_CONFIRMADO,
      ASK_DIRECCION,
      FALLBACK_AUDIO,
    ];
    expect(textos.length).toBeGreaterThan(10);
    expect(voseoEn(textos)).toEqual([]);
  });

  it("un rechazo con devolución: el cliente da su cuenta y la dueña marca la devolución", async () => {
    const { config, repo, db, pedidos, enviados } = await pedidoConComprobante(20000);
    const rechazo = await handleOwnerApproval(
      deLaDueña(config, "Rechazar", `rechazar:${db.pedidos[0].id}`), config, repo, new Date(), pedidos, "neg-1",
    );
    expect(db.pedidos[0].estado).toBe("rechazado");
    const cuenta = await handleIncoming(
      delCliente(config, "Nequi 300 123 4567 Laura Pérez"), config, repo, new Date(), undefined, undefined, undefined,
      { async send(m: OutgoingMessage) { enviados.push(m); } }, undefined, "neg-1", undefined, undefined, undefined, pedidos,
    );

    const textos = [
      ...textosDe([...enviados, ...cuenta.messages, rechazo.ownerReply, rechazo.customerReply]),
      mensajePedirCuenta("$ 20.000"),
      mensajeCuentaRecibida(1, "$ 20.000"),
      avisoCuentaParaDueña({ numero: 1, cliente: "Laura", contacto: CLIENTE }, "$ 20.000", "Nequi 300 123 4567"),
      mensajeDevuelto(1, "$ 20.000"),
      DEFAULT_PEDIDO_RECHAZADO,
    ];
    expect(voseoEn(textos)).toEqual([]);
  });

  it("una cita de peluquería, de la bienvenida a la confirmación", async () => {
    const config = plantilla("peluqueria");
    const repo = new RepoEnMemoria();
    const enviados: OutgoingMessage[] = [];
    const notifier = { async send(m: OutgoingMessage) { enviados.push(m); } };
    for (const texto of ["hola", "corte dama", "Laura", "mañana a las 3 de la tarde", "sí", "gracias"]) {
      const { messages } = await handleIncoming(delCliente(config, texto), config, repo, new Date(), undefined, undefined, undefined, notifier);
      enviados.push(...messages);
    }
    expect(repo.leads[0].stage).toBe("datos_completos");
    expect(voseoEn(textosDe(enviados))).toEqual([]);
  });

  it("los textos configurados de todas las plantillas de rubro", () => {
    const textos = RUBROS_BASE.flatMap(({ template: t }) => [
      ...Object.values(t.messages).filter((m): m is string => typeof m === "string"),
      ...t.followUps.map((f) => f.message),
      ...t.services.map((s) => s.description),
      t.pedidos?.pregunta ?? "",
      ...(t.ai?.reglas?.map((r) => r.respuesta) ?? []),
    ]);
    expect(voseoEn(textos)).toEqual([]);
  });

  it("los prompts de la IA: sin voseo, y el del agente pide trato de usted", () => {
    const config = plantilla("restaurante");
    const input: AgentTurnInput = {
      businessName: config.name,
      rubro: config.rubro,
      persona: { name: "Carlos", tone: "Cálido", language: "español de Colombia, trato de usted" },
      services: config.services.map((s) => ({ ...s, modo: "pedido" as const })),
      currency: config.currency,
      locale: config.locale,
      timezone: config.timezone,
      nowISO: new Date().toISOString(),
      horarios: config.horarios,
      pedidos: config.pedidos,
      knowledge: config.ai?.knowledge,
      lead: { offTopicCount: 1, yaConfirmado: true, esperandoAprobacion: true },
      history: [],
      message: "hola",
    } as unknown as AgentTurnInput;
    const agente = buildAgentSystemPrompt(input);
    const clasico = buildSystemPrompt({
      businessName: config.name,
      persona: input.persona,
      history: [],
      draftResponse: "Hola",
    } as unknown as Parameters<typeof buildSystemPrompt>[0]);

    expect(agente).toContain(TRATO_AL_CLIENTE);
    expect(clasico).toContain(TRATO_AL_CLIENTE);
    // La instrucción nombra el voseo para prohibirlo: se saca antes de revisar.
    const prompts = [agente, clasico].map((p) => p.replace(TRATO_AL_CLIENTE, ""));
    prompts.push(
      buildDateExtractionPrompt({ nowISO: new Date().toISOString(), timezone: "America/Bogota" }),
      buildInterpretPrompt({ options: ["Sí, confirmar"], stage: "esperando_confirmacion" }),
      buildImageDescriptionPrompt(),
      buildPaymentReceiptPrompt(),
    );
    expect(voseoEn(prompts)).toEqual([]);
  });
});
