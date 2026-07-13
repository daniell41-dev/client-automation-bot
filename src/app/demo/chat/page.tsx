/**
 * /demo/chat — chat público contra el negocio de demostración,
 * usando el PhonePreview compartido con mensajes reales del bot.
 */

import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/anon";
import { Logo } from "@/components/logo";
import { DemoChat } from "./demo-chat";
import { ArrowLeft } from "lucide-react";

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
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-6 py-3.5">
          <Logo />
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mid hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la demo
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-8 fade-up">
        <h1 className="text-[22px] font-extrabold text-ink">Probá el bot</h1>
        <p className="mb-6 mt-1 text-sm text-ink-mid">
          Escribile como si fueras un cliente por WhatsApp.
        </p>
        <DemoChat businessSlug={slug} />
      </main>
    </div>
  );
}
