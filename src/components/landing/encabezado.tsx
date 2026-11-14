import Link from "next/link";
import { Logo } from "@/components/logo";

/** T-80: logo · "Ver la demo" · "Entrar" (discreto: quien ya es cliente lo busca, al resto no lo distrae). */
export function Encabezado() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <Link href="/" aria-label="Nexo, inicio" className="inline-flex min-h-12 items-center">
        <Logo variant="dark" />
      </Link>
      <nav className="flex items-center gap-1 text-sm sm:gap-2">
        <Link
          href="/demo"
          className="inline-flex min-h-12 items-center rounded-[10px] border border-white/20 px-3 font-semibold text-white transition-colors hover:bg-white/10 sm:px-4"
        >
          Ver la demo
        </Link>
        <Link href="/login" className="inline-flex min-h-12 items-center px-2 font-medium text-white/60 transition-colors hover:text-white sm:px-3">
          Entrar
        </Link>
      </nav>
    </header>
  );
}
