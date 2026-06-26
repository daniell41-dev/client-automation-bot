/**
 * Simulador offline del bot (`pnpm sim`).
 *
 * Pasa uno o más mensajes por el MISMO motor que usa el webhook, pero con un
 * repositorio en memoria y sin red ni tokens. Sirve para probar y demostrar la
 * conversación completa mientras se tramita la cuenta de WhatsApp Business.
 *
 * Uso:
 *   pnpm sim "Hola, quiero info de limpieza facial"
 *   pnpm sim "Hola" "limpieza facial" "Laura" "el viernes"
 *   pnpm sim "Hola" --business estetica-bella
 */

import { getBusinessBySlug, listBusinesses } from "@/businesses/registry";
import { handleIncoming } from "@/core/handle";
import { nextAction } from "@/core/engine/lead-state";
import { createGeminiProvider } from "@/core/ai/gemini";
import { SessionJsonRepository } from "@/core/storage/adapters/session-json";
import type { IncomingMessage, Lead } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";

/** Repositorio en memoria: la conversación vive solo durante esta ejecución. */
class MemoryRepo implements LeadRepository {
  private leads: Lead[] = [];
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

function parseArgs(argv: string[]): { businessSlug: string; messages: string[] } {
  let businessSlug = "estetica-bella";
  const messages: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--business" || arg === "-b") {
      businessSlug = argv[++i] ?? businessSlug;
    } else {
      messages.push(arg);
    }
  }
  return { businessSlug, messages };
}

async function main() {
  // Carga .env.local si existe (las vars de entorno aún no las inyecta tsx).
  try {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) process.env[m[1].trim()] ??= m[2].trim();
    }
  } catch { /* .env.local no existe, continuar sin ella */ }

  const { businessSlug, messages } = parseArgs(process.argv.slice(2));

  const business = getBusinessBySlug(businessSlug);
  if (!business) {
    console.error(`❌ Negocio "${businessSlug}" no encontrado.`);
    console.error(
      `   Disponibles: ${listBusinesses().map((b) => b.slug).join(", ")}`,
    );
    process.exit(1);
  }

  if (messages.length === 0) {
    console.error('Uso: pnpm sim "tu mensaje" [--business <slug>]');
    process.exit(1);
  }

  console.log(`\n🏭 Simulando conversación con: ${business.name} (${business.slug})\n`);

  const repo = new MemoryRepo();
  const llm = createGeminiProvider();
  const sessionRepo = llm ? new SessionJsonRepository() : undefined;

  if (llm) {
    const persona = business.personas?.mock ?? business.personas?.whatsapp;
    console.log(`✨ IA habilitada (Gemini)${persona ? ` · Persona: ${persona.name}` : ""}\n`);
  }

  const from = "57300000000";

  for (const text of messages) {
    console.log(`👤 Cliente: ${text}`);
    const message: IncomingMessage = {
      channel: "mock",
      businessSlug,
      from,
      text,
      timestamp: new Date().toISOString(),
    };
    const replies = await handleIncoming(
      message,
      business,
      repo,
      new Date(),
      llm ?? undefined,
      sessionRepo,
    );
    for (const reply of replies) {
      console.log(`🤖 Bot: ${reply.text}`);
      if (reply.options?.length) {
        console.log(`        [opciones: ${reply.options.join(" · ")}]`);
      }
    }
    console.log("");
  }

  const lead = await repo.findByContact(businessSlug, from);
  if (lead) {
    const servicio =
      business.services.find((s) => s.id === lead.serviceId)?.name ?? "—";
    console.log("📇 Lead resultante:");
    console.log(`   Nombre:        ${lead.name ?? "—"}`);
    console.log(`   Servicio:      ${servicio}`);
    console.log(`   Fecha tentat.: ${lead.tentativeDate ?? "—"}`);
    console.log(`   Estado:        ${lead.state}`);
    console.log(`   Etapa:         ${lead.stage}`);
    console.log(`   Próxima acción: ${nextAction(lead.state)}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
