/**
 * T-70: marco común de las páginas legales (privacidad, términos, borrado de
 * datos). Fondo claro y texto a 68 caracteres de ancho: son páginas para
 * leer, a diferencia de la landing.
 */

import Link from "next/link";
import { Logo } from "@/components/logo";
import { ACTUALIZADO } from "@/lib/legal";

export function PaginaLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Ir al inicio">
            <Logo />
          </Link>
          <nav className="flex gap-4 text-sm font-semibold text-ink-mid">
            <Link href="/privacidad" className="hover:text-primary">Privacidad</Link>
            <Link href="/terminos" className="hover:text-primary">Términos</Link>
          </nav>
        </div>
      </header>
      <article className="prosa-legal mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <h1>{titulo}</h1>
        <p className="actualizado">Última actualización: {ACTUALIZADO}</p>
        {children}
      </article>
    </main>
  );
}
