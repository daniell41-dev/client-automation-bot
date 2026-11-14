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

const PREGUNTAS: { pregunta: string; respuesta: React.ReactNode }[] = [
  {
    pregunta: "¿Necesito cambiar de número?",
    // Meta no deja usar el mismo número en la app de WhatsApp y en la conexión
    // para empresas a la vez: por eso se dice que el número queda dedicado.
    respuesta:
      "No tiene que comprar nada. Puede usar una línea nueva o la del negocio; lo único es que ese número queda dedicado a atender a sus clientes desde Nexo y ya no se usa en la app de WhatsApp del celular. En la visita le explicamos las dos opciones y elegimos juntos la que mejor le quede.",
  },
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
    respuesta:
      "Claro. Usted ve todas las conversaciones desde el celular y, cuando quiera atender personalmente, pausa las respuestas automáticas y escribe usted.",
  },
  {
    pregunta: "¿Funciona con Nequi y transferencias?",
    respuesta: "Sí. Nexo le envía al cliente sus datos de pago y revisa el comprobante que le mandan.",
  },
  {
    pregunta: "¿Cuánto tarda la instalación?",
    respuesta:
      "Si ya tiene listo su menú con precios y el número que va a usar, en unos 30 minutos lo dejamos funcionando. Si le falta algo, lo preparamos con usted sin afán.",
  },
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
