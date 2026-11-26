/**
 * T-87: "Así funciona" como línea de tiempo vertical en vez de cuatro cajas
 * iguales. Cada paso trae su número grande, la frase y, al lado, una escena
 * del chat hecha con las mismas piezas del teléfono del hero (`chat.tsx`):
 * así la dueña reconoce lo que ya vio arriba y ve dónde entra cada paso.
 *
 * En escritorio los pasos alternan de lado alrededor de la línea central; en
 * celular, la línea va a la izquierda y la escena debajo de la frase.
 * Componente de servidor, sin JavaScript.
 *
 * T-93: la línea se llena de azul a medida que se baja (la punta va siempre
 * por la mitad de la pantalla), el número de cada paso se enciende cuando la
 * punta lo alcanza y su escena entra desde su lado. CSS ligado al scroll
 * (globals.css, "T-93"); sin soporte o con "reducir movimiento" se ve el
 * final: la línea llena y los cuatro números encendidos.
 */

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { AvisoOk, Burbuja, ComprobanteMini, FondoChat, NotaVoz } from "@/components/landing/chat";
import { Seccion } from "@/components/landing/seccion";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (landing.comoFunciona). */
const tt = textos.landing.comoFunciona;

const PASOS: { frase: string; escena: ReactNode }[] = [
  {
    frase: tt.suClienteEscribeO,
    escena: <NotaVoz />,
  },
  {
    frase: tt.aurelaArmaElPedido,
    escena: (
      <>
        <Burbuja de="negocio">
          {tt.suPedido2xHamburguesa}
        </Burbuja>
        <Burbuja de="cliente">{tt.confirmo}</Burbuja>
      </>
    ),
  },
  {
    frase: tt.aurelaRevisaElComprobante,
    escena: (
      <>
        {/* Mismo pedido que el hero, con su final feliz: el pago cuadra. */}
        <ComprobanteMini monto="$45.000" />
        <AvisoOk>{tt.pagoVerificado45000}</AvisoOk>
      </>
    ),
  },
  {
    frase: tt.ustedApruebaConUn,
    escena: (
      <>
        <span className="self-start rounded-lg bg-primary px-4 py-1.5 text-[12.5px] font-bold text-white shadow-card">{tt.aprobar}</span>
        <p className="inline-flex items-center gap-1.5 self-end rounded-full bg-success-bg px-3 py-1 text-[12px] font-bold text-success-ink shadow-card">
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          <span>{tt.pedido}<span className="font-display">#128</span>{tt.aprobado}</span>
        </p>
      </>
    ),
  },
];

export function ComoFunciona() {
  return (
    <Seccion id="como-funciona" titulo={tt.asiFunciona} oscura>
      <ol className="pasos relative mt-10">
        {/* La línea: a la izquierda en celular, al centro en escritorio. */}
        <span aria-hidden className="absolute bottom-6 left-[23px] top-6 w-px bg-white/15 lg:left-1/2" />
        {/* El relleno, encima, en el mismo lugar: crece desde arriba (scaleY). */}
        <span aria-hidden className="paso-relleno absolute bottom-6 left-[22px] top-6 w-[3px] rounded-full bg-primary-light lg:left-[calc(50%-1px)]" />

        {PASOS.map((paso, i) => {
          const derecha = i % 2 === 1; // en escritorio, los pares van con la frase a la derecha
          return (
            <li key={paso.frase} className="relative grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 pb-12 last:pb-0 lg:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] lg:gap-x-0">
              {/* Número sobre la línea */}
              <span
                className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[#2A0F2E] font-display text-[28px] font-bold text-white ring-1 ring-white/20 lg:col-start-2 lg:row-start-1 lg:mx-auto lg:h-16 lg:w-16 lg:text-[36px]`}
              >
                {/* La luz del número: un círculo azul encima del oscuro, que aparece cuando la línea llega. */}
                <span aria-hidden className="paso-luz absolute inset-0 rounded-full bg-primary shadow-[0_0_24px_-2px_rgba(168,93,179,0.8)]" />
                <span className="relative">{i + 1}</span>
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
                className={`col-start-2 mt-4 lg:row-start-1 lg:mt-0 ${derecha ? "paso-escena-izq lg:col-start-1 lg:flex lg:justify-end lg:pr-10" : "paso-escena-der lg:col-start-3 lg:pl-10"}`}
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
