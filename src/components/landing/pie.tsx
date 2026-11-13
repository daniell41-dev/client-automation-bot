import Link from "next/link";
import { INSTAGRAM } from "@/app/landing-config";
import { enlaceInstagram } from "@/lib/enlace-whatsapp";

export function Pie() {
  const instagram = enlaceInstagram(INSTAGRAM);
  return (
    // T-70: Meta y la ley piden que la política esté a la vista desde la portada.
    <footer className="bg-[#0E2033]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-white/10 px-4 py-8 text-sm text-white/55 sm:px-6">
        <span>© {new Date().getFullYear()} Nexo · Cúcuta, Colombia</span>
        <Link href="/privacidad" className="hover:text-white">Privacidad</Link>
        <Link href="/terminos" className="hover:text-white">Términos</Link>
        <Link href="/eliminar-datos" className="hover:text-white">Eliminar mis datos</Link>
        <Link href="/login" className="hover:text-white">Entrar al portal</Link>
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white">
            Instagram
          </a>
        )}
      </div>
    </footer>
  );
}
