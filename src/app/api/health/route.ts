/**
 * T-65: chequeo de salud para el monitor de disponibilidad (UptimeRobot,
 * Better Stack…). El monitor lo llama cada minuto y avisa al celular si no
 * responde 200 — así nos enteramos de una caída antes que el cliente.
 *
 * Revisa también que la base responda: si Supabase está caído, el bot
 * "está prendido" pero no puede guardar pedidos, y eso también es una caída.
 * No devuelve detalles internos: la ruta es pública.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuánto se espera a la base antes de darla por caída. */
const TIMEOUT_BASE_MS = 3000;

/** `true` si la base responde a tiempo; `null` si no hay Supabase configurado (modo local JSON). */
async function baseResponde(): Promise<boolean | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  try {
    const { error } = await admin
      .from("negocios")
      .select("id", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_BASE_MS));
    return !error;
  } catch {
    return false;
  }
}

export async function GET(): Promise<NextResponse> {
  const base = await baseResponde();
  const ok = base !== false;
  return NextResponse.json(
    { ok, base: base === null ? "sin configurar" : base ? "ok" : "caída", hora: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
