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
 * Recibe precio y nota por props (por defecto, los de landing-config.ts) para
 * poder probar los tres casos sin tocar la configuración.
 */

import { Check, ShieldCheck } from "lucide-react";
import { NOTA_PRECIO, PRECIO_DESDE } from "@/app/landing-config";
import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";
import { Seccion } from "@/components/landing/seccion";

const CONDICIONES = ["Instalación gratis en su negocio", "14 días de prueba", "Sin permanencia"];

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
          <p className="text-center">
            <span className="block text-[15px] font-semibold text-ink-mid">Desde</span>
            <span className="block font-display text-[56px] font-bold leading-none tracking-tight text-ink sm:text-[72px]">
              {precio}
            </span>
            <span className="mt-1 block text-[15px] font-semibold text-ink-mid">al mes</span>
          </p>

          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {CONDICIONES.map((c) => (
              <li key={c} className="rounded-full bg-primary-tint px-3 py-1.5 text-[13px] font-semibold text-primary-hover">
                {c}
              </li>
            ))}
          </ul>

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
