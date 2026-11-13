import Link from "next/link";
import { Logo } from "@/components/logo";

/** T-80: logo · "Ver la demo" · "Entrar" (discreto: quien ya es cliente lo busca, al resto no lo distrae). */
export function Encabezado() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <Link href="/" aria-label="Nexo, inicio">
        <Logo variant="dark" />
      </Link>
      <nav className="flex items-center gap-1 text-sm sm:gap-2">
        <Link
          href="/demo"
          className="rounded-[10px] border border-white/20 px-3 py-2 font-semibold text-white transition-colors hover:bg-white/10 sm:px-4"
        >
          Ver la demo
        </Link>
        <Link href="/login" className="px-2 py-2 font-medium text-white/60 transition-colors hover:text-white sm:px-3">
          Entrar
        </Link>
      </nav>
    </header>
  );
}
