import { Calculator, Clock, Copy } from "lucide-react";
import { Seccion } from "@/components/landing/seccion";

/** T-80: el problema en tres escenas que la dueña ya vivió; sin cifras que no podemos respaldar. */
const PERDIDAS = [
  { Icono: Clock, texto: "El cliente que escribió a las 9 p. m. y le compró a otro." },
  { Icono: Calculator, texto: "El total mal sumado en plena hora pico." },
  { Icono: Copy, texto: "El comprobante que ya le habían mandado antes." },
];

export function Perdidas() {
  return (
    <Seccion id="perdidas" titulo="Lo que se pierde cuando nadie responde">
      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        {PERDIDAS.map(({ Icono, texto }) => (
          <li key={texto} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-warn-bg text-warn-ink">
              <Icono className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-[17px] font-bold leading-snug text-ink">{texto}</p>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
