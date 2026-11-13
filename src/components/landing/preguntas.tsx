/**
 * T-80: preguntas frecuentes con <details> nativo: se abren sin JavaScript y
 * funcionan con lector de pantalla.
 *
 * Las respuestas "[CONFIRMAR CON DANIEL]" quedan a la vista a propósito:
 * dependen de decisiones del negocio (Meta, tiempos de instalación) y una
 * respuesta inventada sería una promesa que después habría que cumplir.
 */

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Seccion } from "@/components/landing/seccion";

export const POR_CONFIRMAR = "[CONFIRMAR CON DANIEL]";

const PREGUNTAS: { pregunta: string; respuesta: React.ReactNode }[] = [
  { pregunta: "¿Necesito cambiar de número?", respuesta: POR_CONFIRMAR },
  {
    pregunta: "¿Qué pasa con los datos de mis clientes?",
    respuesta: (
      <>
        Los tratamos según la Ley 1581 de 2012. Puede leer nuestra{" "}
        <Link href="/privacidad" className="font-semibold text-primary underline underline-offset-2">
          política de privacidad
        </Link>
        .
      </>
    ),
  },
  {
    pregunta: "¿Puedo responder yo cuando quiera?",
    respuesta: "Sí. Usted ve las conversaciones y puede pausar el bot en cualquier momento.",
  },
  {
    pregunta: "¿Funciona con Nequi y transferencias?",
    respuesta: "Sí. Nexo le envía al cliente sus datos de pago y revisa el comprobante que le mandan.",
  },
  { pregunta: "¿Cuánto tarda la instalación?", respuesta: POR_CONFIRMAR },
];

export function Preguntas() {
  return (
    <Seccion id="preguntas" titulo="Preguntas frecuentes">
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
