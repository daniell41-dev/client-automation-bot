import Link from "next/link";
import { INSTAGRAM } from "@/app/landing-config";
import { enlaceInstagram } from "@/lib/enlace-whatsapp";

export function Pie() {
  const instagram = enlaceInstagram(INSTAGRAM);
  return (
    // T-70: Meta y la ley piden que la política esté a la vista desde la portada.
    <footer className="bg-[#0E2033]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-0 border-t border-white/10 px-4 py-8 text-sm text-white/55 sm:px-6">
        <span>© {new Date().getFullYear()} Nexo · Cúcuta, Colombia</span>
        <Link href="/privacidad" className="inline-flex min-h-12 items-center hover:text-white">Privacidad</Link>
        <Link href="/terminos" className="inline-flex min-h-12 items-center hover:text-white">Términos</Link>
        <Link href="/eliminar-datos" className="inline-flex min-h-12 items-center hover:text-white">Eliminar mis datos</Link>
        <Link href="/login" className="inline-flex min-h-12 items-center hover:text-white">Entrar al portal</Link>
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center hover:text-white">
            Instagram
          </a>
        )}
      </div>
    </footer>
  );
}
