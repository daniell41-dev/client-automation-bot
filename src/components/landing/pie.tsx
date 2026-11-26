import Link from "next/link";
import { INSTAGRAM } from "@/app/landing-config";
import { enlaceInstagram } from "@/lib/enlace-whatsapp";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (landing.pie). */
const tt = textos.landing.pie;

export function Pie() {
  const instagram = enlaceInstagram(INSTAGRAM);
  return (
    // T-70: Meta y la ley piden que la política esté a la vista desde la portada.
    <footer className="bg-[#2A0F2E]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-0 border-t border-white/10 px-4 py-8 text-sm text-white/55 sm:px-6">
        <span>© {new Date().getFullYear()}{tt.aurelaCucutaColombia}</span>
        <Link href="/privacidad" className="inline-flex min-h-12 items-center hover:text-white">{tt.privacidad}</Link>
        <Link href="/terminos" className="inline-flex min-h-12 items-center hover:text-white">{tt.terminos}</Link>
        <Link href="/eliminar-datos" className="inline-flex min-h-12 items-center hover:text-white">{tt.eliminarMisDatos}</Link>
        <Link href="/login" className="inline-flex min-h-12 items-center hover:text-white">{tt.entrarAlPortal}</Link>
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center hover:text-white">{tt.instagram}</a>
        )}
      </div>
    </footer>
  );
}
