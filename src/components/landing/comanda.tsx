/**
 * T-95: la comanda que acompaña la página. Entre algunas secciones aparece un
 * talón del mismo pedido #128 del teléfono del hero, con su hora y lo que
 * pasó: llega la nota de voz, el cliente confirma el total, Nexo revisa el
 * comprobante y avisa que falta plata, y usted lo aprueba. Así, al bajar, la
 * historia del hero sigue avanzando y une las secciones.
 *
 * El talón va encima del borde entre dos secciones (un contenedor de alto 0
 * con el talón centrado sobre la línea): no agrega ni quita espacio. Sale de
 * una "ranura" como de impresora al aparecer (CSS ligado al scroll,
 * globals.css "T-95"); sin soporte o con "reducir movimiento" se ve quieto.
 *
 * Va en z-[15]: encima de las secciones (y de sus capas z-10) pero debajo
 * de la barra fija de WhatsApp del celular (z-20).
 *
 * Es decorativo (`aria-hidden`): la historia completa ya la tiene el lector
 * de pantalla en la descripción del teléfono del hero.
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";

/** Los cuatro momentos del pedido #128, en orden. Mismos montos que el teléfono del hero. */
export const MOMENTOS_COMANDA = {
  nota: { hora: "10:47 p. m.", texto: "Llega una nota de voz" },
  total: { hora: "10:48 p. m.", texto: "Total confirmado: $45.000" },
  comprobante: { hora: "10:49 p. m.", texto: "Comprobante: faltan $5.000", alerta: true },
  aprobado: { hora: "10:52 p. m.", texto: "Pedido aprobado por usted" },
} as const;

export function TalonComanda({ momento }: { momento: keyof typeof MOMENTOS_COMANDA }) {
  const m: { hora: string; texto: string; alerta?: boolean } = MOMENTOS_COMANDA[momento];
  return (
    <div aria-hidden className="relative z-[15] h-0">
      <div className="absolute left-1/2 top-0 w-max max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_6px_14px_rgba(14,32,51,0.28)]">
        {/* La ranura recorta el talón mientras "sale" (overflow-hidden). */}
        <div className="comanda-ranura overflow-hidden">
          <div className="comanda-talon flex flex-col items-start gap-0.5 bg-surface px-5 py-2 sm:flex-row sm:items-center sm:gap-3 sm:py-2.5">
            <span className="flex items-center gap-2 font-display text-[11.5px] font-bold text-ink-mid">
              <span className="uppercase tracking-[0.14em]">#128</span>
              <span>{m.hora}</span>
            </span>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className={`flex items-center gap-1.5 text-[13.5px] font-bold ${m.alerta ? "text-warn-ink" : "text-ink"}`}>
              {m.texto}
              {m.alerta ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
