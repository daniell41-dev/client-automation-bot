/**
 * /demo/chat — chat público contra el negocio de demostración.
 * El server component resuelve el slug demo; el chat es un client component
 * que habla con /api/dev/simulate (permitido en producción solo para demos).
 */

import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/anon";
import { DemoChat } from "./demo-chat";

export const dynamic = "force-dynamic";

export default async function DemoChatPage() {
  const supabase = createAnonClient();
  let slug = "estetica-bella"; // fallback: registry estático en desarrollo

  if (supabase) {
    const { data } = await supabase
      .from("negocios")
      .select("slug")
      .eq("es_demo", true)
      .limit(1)
      .maybeSingle();
    if (data) slug = data.slug;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Prueba el bot</h1>
          <p className="text-sm text-slate-500">
            Escríbele como si fueras un cliente por WhatsApp
          </p>
        </div>
        <Link href="/demo" className="text-sm text-blue-600 hover:underline">
          ← Volver
        </Link>
      </header>
      <DemoChat businessSlug={slug} />
    </main>
  );
}
