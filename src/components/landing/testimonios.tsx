import { TESTIMONIOS } from "@/app/landing-config";
import { Seccion } from "@/components/landing/seccion";

/** T-80: solo aparece con testimonios reales cargados en `landing-config.ts`. Vacío = no hay sección. */
export function Testimonios() {
  if (TESTIMONIOS.length === 0) return null;
  return (
    <Seccion id="testimonios" titulo="Testimonios">
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {TESTIMONIOS.map((t) => (
          <li key={t.nombre + t.negocio} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <blockquote className="text-[16px] leading-relaxed text-ink">“{t.texto}”</blockquote>
            <p className="mt-3 text-sm font-bold text-ink">{t.nombre}</p>
            <p className="text-sm text-ink-mid">{t.negocio}</p>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
