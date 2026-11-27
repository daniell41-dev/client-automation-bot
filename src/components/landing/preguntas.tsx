/**
 * T-80: preguntas frecuentes con <details> nativo: se abren sin JavaScript y
 * funcionan con lector de pantalla.
 *
 * T-81: aquí no se dice "bot". La dueña que pregunta está pensando en sus
 * clientes y en su número, no en tecnología: se le responde como lo haría
 * una persona que la va a visitar. Las respuestas sobre el número y la
 * instalación las confirmó Daniel; un plazo o una condición inventada sería
 * una promesa que después habría que cumplir.
 */

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Seccion } from "@/components/landing/seccion";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (landing.preguntas). */
const tt = textos.landing.preguntas;

const PREGUNTAS: { pregunta: string; respuesta: React.ReactNode }[] = [
  {
    pregunta: tt.necesitoCambiarDeNumero,
    // Meta no deja usar el mismo número en la app de WhatsApp y en la conexión
    // para empresas a la vez: por eso se dice que el número queda dedicado.
    respuesta:
      tt.noTieneQueComprar,
  },
  {
    pregunta: tt.quePasaConLos,
    respuesta: (
      <>{tt.losTratamosSegunLa}{" "}
        <Link href="/privacidad" className="font-semibold text-primary underline underline-offset-2">{tt.politicaDePrivacidad}</Link>
        .
      </>
    ),
  },
  {
    pregunta: tt.puedoResponderYoCuando,
    respuesta:
      tt.claroUstedVeTodas,
  },
  {
    pregunta: tt.funcionaConNequiY,
    respuesta: tt.siAurelaLeEnvia,
  },
  {
    pregunta: tt.cuantoTardaLaInstalacion,
    respuesta:
      tt.siYaTieneListo,
  },
];

export function Preguntas() {
  return (
    <Seccion id="preguntas" titulo={tt.preguntasFrecuentes}>
      <div className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {PREGUNTAS.map(({ pregunta, respuesta }) => (
          <details key={pregunta} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold text-ink [&::-webkit-details-marker]:hidden">
              {pregunta}
              <ChevronDown className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-mid">{respuesta}</p>
          </details>
        ))}
      </div>
    </Seccion>
  );
}
