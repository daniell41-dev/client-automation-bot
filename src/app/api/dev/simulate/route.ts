/**
 * Ruta de simulación del bot.
 *
 * Permite probar el bot desde el navegador / un fetch, sin Meta. Persiste el
 * lead en el backend configurado (Supabase / Sheets / JSON).
 *
 * En desarrollo acepta cualquier negocio. En producción SOLO los negocios de
 * demostración (`es_demo = true`): es lo que usa el chat público de /demo.
 *
 * Ejemplo:
 *   curl -X POST http://localhost:3000/api/dev/simulate \
 *     -H 'Content-Type: application/json' \
 *     -d '{"message":"Hola, quiero info de limpieza facial"}'
 */

import { resolveBusinessBySlug } from "@/businesses/resolve";
import {
  createCalendar,
  createLeadRepository,
  createSessionRepository,
} from "@/core/storage/factory";
import { createGroqProvider } from "@/core/ai/groq";
import { handleIncoming } from "@/core/handle";
import type { Channel, IncomingMessage } from "@/core/types";

export const runtime = "nodejs";

interface SimulateBody {
  message?: string;
  business?: string;
  from?: string;
  channel?: Channel;
}

export async function POST(request: Request): Promise<Response> {
  let body: SimulateBody;
  try {
    body = (await request.json()) as SimulateBody;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const slug = body.business ?? "estetica-bella";
  const from = body.from ?? "sim-user";
  if (!body.message) {
    return Response.json({ error: "Falta 'message'" }, { status: 400 });
  }

  const resolved = await resolveBusinessBySlug(slug);
  if (!resolved) {
    return Response.json(
      { error: `Negocio "${slug}" no encontrado` },
      { status: 400 },
    );
  }

  // En producción solo se permite chatear con negocios de demostración.
  if (process.env.NODE_ENV === "production" && !resolved.esDemo) {
    return new Response("Not found", { status: 404 });
  }
  const business = resolved.config;

  // Bot en pausa → no procesa el mensaje (igual que el webhook real).
  if (business.botActivo === false) {
    return Response.json({
      replies: [],
      lead: null,
      _debug: { bot_paused: true },
    });
  }

  const repo = createLeadRepository(business);
  const llm = createGroqProvider();
  const sessionRepo = llm ? createSessionRepository(business) : undefined;
  const calendar = createCalendar(business) ?? undefined;

  const message: IncomingMessage = {
    channel: body.channel ?? "whatsapp",
    businessSlug: slug,
    from,
    text: body.message,
    timestamp: new Date().toISOString(),
  };

  const replies = await handleIncoming(
    message,
    business,
    repo,
    new Date(),
    llm ?? undefined,
    sessionRepo,
    calendar,
  );
  const lead = await repo.findByContact(slug, from);

  return Response.json({
    replies,
    lead,
    _debug: { ai_active: !!llm, model: llm?.model ?? null },
  });
}
