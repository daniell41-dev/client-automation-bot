/**
 * Landing mínima: presenta la plataforma y deriva a la demo o al login.
 */

import Link from "next/link";
import { Logo } from "@/components/logo";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col"
      style={{
        background:
          "radial-gradient(80% 60% at 50% 0%, rgba(42,111,219,.28) 0%, rgba(14,32,51,0) 55%), #0E2033",
      }}
    >
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5">
        <Logo variant="dark" />
        <Link
          href="/login"
          className="rounded-[10px] border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Iniciar sesión
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center fade-up">
        <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-[52px]">
          Tu negocio, respondiendo en WhatsApp las 24 horas.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70 sm:text-[17px]">
          Gestioná el catálogo, los turnos y las respuestas de tu bot desde un
          solo lugar. Sin escribir una línea de código.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/demo"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            Ver la demo
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-[10px] border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Entrar a mi portal
          </Link>
        </div>
      </section>
    </main>
  );
}
