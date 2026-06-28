/**
 * Simulador offline del bot (`pnpm sim`).
 *
 * Pasa mensajes por el MISMO motor que usa el webhook, pero sin red ni tokens.
 * Dos modos de prueba:
 *
 * MODO A — REPL interactivo (sin argumentos de mensaje):
 *   pnpm sim
 *   pnpm sim --business estetica-bella
 *   → abre un chat en consola; el estado persiste entre turnos dentro del proceso.
 *   Comandos: /lead · /reset · /salir
 *
 * MODO B — Comandos persistentes (con uno o más mensajes):
 *   pnpm sim "Hola, quiero info de limpieza facial"
 *   pnpm sim "Hola" "limpieza facial" "Laura" "el viernes"
 *   pnpm sim --reset "Hola"    ← limpia data/sim/ y empieza de cero
 *   pnpm sim --reset            ← solo limpia, sin enviar mensaje
 *   → el estado se guarda en data/sim/ y persiste entre comandos.
 */

import { rm } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";

import { getBusinessBySlug, listBusinesses } from "@/businesses/registry";
import { handleIncoming } from "@/core/handle";
import { nextAction } from "@/core/engine/lead-state";
import { createGroqProvider } from "@/core/ai/groq";
import { SessionMemoryRepository } from "@/core/storage/adapters/session-memory";
import { JsonLeadRepository } from "@/core/storage/adapters/json";
import { SessionJsonRepository } from "@/core/storage/adapters/session-json";
import { loadEnvLocal } from "./load-env";
import type { IncomingMessage, BusinessConfig, Lead } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import type { SessionRepository } from "@/core/storage/session-repository";

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

/** Contacto fijo para el modo persistente (comandos separados). */
const SIM_CONTACT = "sim-cli";

/** Directorio aislado donde vive el estado del simulador persistente. */
function simDir(): string {
  return join(process.cwd(), "data", "sim");
}

interface ParsedArgs {
  businessSlug: string;
  messages: string[];
  reset: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  let businessSlug = "estetica-bella";
  let reset = false;
  const messages: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--business" || arg === "-b") {
      businessSlug = argv[++i] ?? businessSlug;
    } else if (arg === "--reset" || arg === "-r") {
      reset = true;
    } else {
      messages.push(arg);
    }
  }
  return { businessSlug, messages, reset };
}

async function printLeadSummary(
  repo: LeadRepository,
  businessSlug: string,
  contact: string,
  business: BusinessConfig,
): Promise<void> {
  const lead = await repo.findByContact(businessSlug, contact);
  if (!lead) {
    console.log("📇 Sin lead todavía.\n");
    return;
  }
  const servicio =
    business.services.find((s) => s.id === lead.serviceId)?.name ?? "—";
  console.log("📇 Lead:");
  console.log(`   Nombre:         ${lead.name ?? "—"}`);
  console.log(`   Servicio:       ${servicio}`);
  console.log(`   Fecha tentat.:  ${lead.tentativeDate ?? "—"}`);
  console.log(`   Estado:         ${lead.state}`);
  console.log(`   Etapa:          ${lead.stage}`);
  console.log(`   Próxima acción: ${nextAction(lead.state)}\n`);
}

async function sendMessage(
  text: string,
  businessSlug: string,
  contact: string,
  business: BusinessConfig,
  repo: LeadRepository,
  llm: ReturnType<typeof createGroqProvider>,
  sessionRepo: SessionRepository | undefined,
): Promise<void> {
  console.log(`👤 Cliente: ${text}`);
  const message: IncomingMessage = {
    channel: "mock",
    businessSlug,
    from: contact,
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

/** Modo A: REPL interactivo con estado en memoria. */
async function runRepl(
  businessSlug: string,
  business: BusinessConfig,
  llm: ReturnType<typeof createGroqProvider>,
): Promise<void> {
  let repo: LeadRepository = new MemoryRepo();
  let sessionRepo: SessionRepository = new SessionMemoryRepository();
  const contact = "repl-user";

  console.log("💬 Modo interactivo (escribe tu mensaje o /lead · /reset · /salir)\n");

  const rl = createInterface({ input, output });

  rl.on("close", () => {
    console.log("\n👋 ¡Hasta luego!");
    process.exit(0);
  });

  for (;;) {
    let text: string;
    try {
      text = (await rl.question("👤 ")).trim();
    } catch {
      break;
    }
    if (!text) continue;

    if (text === "/salir" || text === "/exit") {
      rl.close();
      break;
    }
    if (text === "/lead") {
      await printLeadSummary(repo, businessSlug, contact, business);
      continue;
    }
    if (text === "/reset") {
      repo = new MemoryRepo();
      sessionRepo = new SessionMemoryRepository();
      console.log("🔄 Conversación reiniciada.\n");
      continue;
    }

    await sendMessage(text, businessSlug, contact, business, repo, llm, sessionRepo);
  }
}

/** Modo B: mensajes pasados por argumento con estado persistido en data/sim/. */
async function runBatch(
  businessSlug: string,
  messages: string[],
  reset: boolean,
  business: BusinessConfig,
  llm: ReturnType<typeof createGroqProvider>,
): Promise<void> {
  const dir = simDir();

  if (reset) {
    await rm(dir, { recursive: true, force: true });
    console.log("🗑️  data/sim/ limpiado.\n");
    if (messages.length === 0) return;
  }

  const repo = new JsonLeadRepository(join(dir, "leads.json"));
  const sessionRepo = new SessionJsonRepository(join(dir, "sessions"));

  // Mostrar estado previo si existe.
  const existing = await repo.findByContact(businessSlug, SIM_CONTACT);
  if (existing) {
    const servicio =
      business.services.find((s) => s.id === existing.serviceId)?.name ?? "—";
    console.log(
      `↩️  Continuando conversación (etapa: ${existing.stage} · estado: ${existing.state} · servicio: ${servicio})\n`,
    );
  } else {
    console.log("✨ Nueva conversación.\n");
  }

  for (const text of messages) {
    await sendMessage(text, businessSlug, SIM_CONTACT, business, repo, llm, sessionRepo);
  }

  await printLeadSummary(repo, businessSlug, SIM_CONTACT, business);
}

async function main() {
  loadEnvLocal();

  const { businessSlug, messages, reset } = parseArgs(process.argv.slice(2));

  const business = getBusinessBySlug(businessSlug);
  if (!business) {
    console.error(`❌ Negocio "${businessSlug}" no encontrado.`);
    console.error(
      `   Disponibles: ${listBusinesses().map((b) => b.slug).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`\n🏭 Simulando conversación con: ${business.name} (${business.slug})\n`);

  const llm = createGroqProvider();

  if (llm) {
    const persona = business.personas?.mock ?? business.personas?.whatsapp;
    console.log(
      `✨ IA habilitada (Groq · ${llm.model})${persona ? ` · Persona: ${persona.name}` : ""}\n`,
    );
  } else {
    console.log("ℹ️  IA desactivada (sin GROQ_API_KEY) — usando plantillas.\n");
  }

  if (messages.length === 0 && !reset) {
    // Modo A: REPL interactivo.
    await runRepl(businessSlug, business, llm);
  } else {
    // Modo B: comandos persistentes.
    await runBatch(businessSlug, messages, reset, business, llm);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
