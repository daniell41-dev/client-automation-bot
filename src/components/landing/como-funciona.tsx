/**
 * T-87: "Así funciona" como línea de tiempo vertical en vez de cuatro cajas
 * iguales. Cada paso trae su número grande, la frase y, al lado, una escena
 * del chat hecha con las mismas piezas del teléfono del hero (`chat.tsx`):
 * así la dueña reconoce lo que ya vio arriba y ve dónde entra cada paso.
 *
 * En escritorio los pasos alternan de lado alrededor de la línea central; en
 * celular, la línea va a la izquierda y la escena debajo de la frase.
 * Componente de servidor, sin animación propia.
 */

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { AvisoAmbar, Burbuja, ComprobanteMini, FondoChat, NotaVoz } from "@/components/landing/chat";
import { Seccion } from "@/components/landing/seccion";

const PASOS: { frase: string; escena: ReactNode }[] = [
  {
    frase: "Su cliente escribe o manda una nota de voz.",
    escena: <NotaVoz />,
  },
  {
    frase: "Nexo arma el pedido con sus precios y el cliente confirma el total.",
    escena: (
      <>
        <Burbuja de="negocio">
          {"Su pedido:\n2x Hamburguesa sencilla $36.000\n1x Gaseosa $4.000\nDomicilio $5.000\nTotal: $45.000\n¿Confirma su pedido?"}
        </Burbuja>
        <Burbuja de="cliente">Confirmo</Burbuja>
      </>
    ),
  },
  {
    frase: "Nexo revisa el comprobante: monto, cuenta, referencia y fecha. Si algo no cuadra, le avisa.",
    escena: (
      <>
        <ComprobanteMini monto="$40.000" />
        <AvisoAmbar>El comprobante dice $40.000, el pedido es $45.000.</AvisoAmbar>
      </>
    ),
  },
  {
    frase: "Usted aprueba con un botón y el cliente recibe su número de pedido.",
    escena: (
      <>
        <span className="self-start rounded-lg bg-primary px-4 py-1.5 text-[12.5px] font-bold text-white shadow-card">Aprobar</span>
        <p className="inline-flex items-center gap-1.5 self-end rounded-full bg-success-bg px-3 py-1 text-[12px] font-bold text-success-ink shadow-card">
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          <span>
            Pedido <span className="font-display">#128</span> aprobado
          </span>
        </p>
      </>
    ),
  },
];

export function ComoFunciona() {
  return (
    <Seccion id="como-funciona" titulo="Así funciona" oscura>
      <ol className="relative mt-10">
        {/* La línea: a la izquierda en celular, al centro en escritorio. */}
        <span aria-hidden className="absolute bottom-6 left-[23px] top-6 w-px bg-white/15 lg:left-1/2" />

        {PASOS.map((paso, i) => {
          const derecha = i % 2 === 1; // en escritorio, los pares van con la frase a la derecha
          return (
            <li key={paso.frase} className="relative grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 pb-12 last:pb-0 lg:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] lg:gap-x-0">
              {/* Número sobre la línea */}
              <span
                className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[#0E2033] font-display text-[28px] font-bold text-white ring-1 ring-white/20 lg:col-start-2 lg:row-start-1 lg:mx-auto lg:h-16 lg:w-16 lg:text-[36px]`}
              >
                {i + 1}
              </span>

              <p
                className={`col-start-2 row-start-1 self-center text-[18px] font-semibold leading-snug text-white sm:text-[20px] lg:row-start-1 lg:self-center ${
                  derecha ? "lg:col-start-3 lg:pl-10" : "lg:col-start-1 lg:pr-10 lg:text-right"
                }`}
              >
                {paso.frase}
              </p>

              <div
                aria-hidden
                className={`col-start-2 mt-4 lg:row-start-1 lg:mt-0 ${derecha ? "lg:col-start-1 lg:flex lg:justify-end lg:pr-10" : "lg:col-start-3 lg:pl-10"}`}
              >
                <FondoChat className="w-full max-w-[320px] lg:max-w-[340px]">{paso.escena}</FondoChat>
              </div>
            </li>
          );
        })}
      </ol>
    </Seccion>
  );
}
