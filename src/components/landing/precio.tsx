/**
 * T-80: sin precio decidido (`PRECIO_DESDE = null`) no se publica ninguno: se
 * invita a preguntar por cupos.
 * T-85: con precio, una sola tarjeta blanca centrada sobre el fondo oscuro, con
 * todo lo que la dueña necesita para decidir en un vistazo: cuánto, qué
 * condiciones, qué incluye y qué pasa si no le sirve.
 *
 * Las condiciones y la garantía dicen lo mismo que los Términos (sección 4:
 * 14 días de prueba gratis sin obligación de continuar, sin permanencia
 * mínima). Si cambian allá, cambian aquí.
 *
 * T-94: la parte de arriba es un ticket que se suma, como la comanda que
 * imprime un negocio: cada condición es una línea con su valor ($0 la
 * instalación, $0 los 14 días, 0 meses de permanencia), se corta con una
 * línea punteada y abajo va el precio mensual en grande. Las líneas se
 * "imprimen" una tras otra al aparecer (CSS ligado al scroll, globals.css
 * "T-94"); sin soporte o con "reducir movimiento" el ticket se ve completo.
 * Los valores no agregan nada que no digan los Términos.
 *
 * Recibe precio y nota por props (por defecto, los de landing-config.ts) para
 * poder probar los tres casos sin tocar la configuración.
 */

import { Check, ShieldCheck } from "lucide-react";
import { NOTA_PRECIO, PRECIO_DESDE } from "@/app/landing-config";
import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";
import { Seccion } from "@/components/landing/seccion";

/** Cada condición del ticket con su valor. Mismas tres condiciones del hero y de los Términos. */
const CONDICIONES = [
  { texto: "Instalación gratis en su negocio", valor: "$0" },
  { texto: "14 días de prueba", valor: "$0" },
  { texto: "Sin permanencia", valor: "0 meses" },
];

const INCLUYE = [
  "Pedidos con total confirmado",
  "Revisión de comprobantes",
  "Pedidos por nota de voz",
  "Citas",
  "Panel de pedidos en el celular",
  "Soporte por WhatsApp",
];

export const GARANTIA = "Si en los 14 días no le sirve, lo desinstalamos y no paga nada.";

export function Precio({
  precio = PRECIO_DESDE,
  nota = NOTA_PRECIO,
}: {
  precio?: string | null;
  nota?: string | null;
}) {
  if (!precio) {
    return (
      <Seccion id="precio" oscura>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[22px] font-extrabold leading-snug text-white sm:text-[28px]">
            Instalamos pocos negocios al mes porque lo hacemos en persona. Pregúntenos por los cupos.
          </p>
          <BotonWhatsApp origen="precios" className="mt-8 w-full sm:w-auto" />
        </div>
      </Seccion>
    );
  }

  return (
    <Seccion id="precio" oscura>
      {/* En celulares de 320 px la tarjeta gana 8 px por lado (-mx-2) y menos
          relleno, para que "Escríbanos por WhatsApp" quepa en una línea. */}
      <div className="mx-auto w-full max-w-md">
        <div className="-mx-2 rounded-2xl bg-surface px-4 py-6 text-ink shadow-lift min-[360px]:mx-0 min-[360px]:px-6 sm:p-8">
          {/* El ticket: borde de papel cortado arriba y abajo (.ticket, una máscara). */}
          <div className="ticket rounded-md bg-surface-3 px-4 pb-6 pt-5 sm:px-5">
            <p className="text-center font-display text-[12px] font-bold uppercase tracking-[0.18em] text-ink-mid">Su cuenta</p>

            <ul className="mt-4 space-y-2.5">
              {CONDICIONES.map((c, i) => (
                <li key={c.texto} className={`ticket-linea ticket-linea-${i + 1} flex items-end gap-2 text-[15px] leading-snug`}>
                  <span className="font-semibold text-ink">{c.texto}</span>
                  {/* Puntos guía, como en una cuenta impresa. */}
                  <span aria-hidden className="mb-[5px] min-w-4 flex-1 border-b-2 border-dotted border-line-2" />
                  <span className="shrink-0 font-display font-bold text-success-ink">{c.valor}</span>
                </li>
              ))}
            </ul>

            <span aria-hidden className="ticket-corte mt-5 block border-t-2 border-dashed border-line-2" />

            <p className="ticket-total mt-5 text-center">
              <span className="block text-[15px] font-semibold text-ink-mid">Desde</span>
              <span className="block font-display text-[56px] font-bold leading-none tracking-tight text-ink sm:text-[72px]">
                {precio}
              </span>
              <span className="mt-1 block text-[15px] font-semibold text-ink-mid">al mes</span>
            </p>
          </div>

          <div className="mt-7 border-t border-line pt-6">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink-mid">Incluye</h3>
            <ul className="mt-3 space-y-2.5">
              {INCLUYE.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[15px] leading-snug text-ink">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={3} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            {nota && <p className="mt-4 text-[13px] leading-relaxed text-ink-mid">{nota}</p>}
          </div>

          <p className="mt-6 flex items-start gap-2.5 rounded-xl bg-success-bg px-4 py-3 text-[14px] font-semibold leading-snug text-success-ink">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            {GARANTIA}
          </p>

          <BotonWhatsApp origen="precios" className="mt-6 w-full" />
        </div>
      </div>
    </Seccion>
  );
}
