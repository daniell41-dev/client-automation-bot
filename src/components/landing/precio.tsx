import { PRECIO_DESDE } from "@/app/landing-config";
import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";
import { Seccion } from "@/components/landing/seccion";

/**
 * T-80: sin precio decidido (`PRECIO_DESDE = null`) no se publica ninguno: se invita a preguntar por cupos.
 * T-81: la instalación es gratis y hay 14 días de prueba (igual que dicen los Términos), así que el
 * precio que se muestra es solo la mensualidad.
 */
export function Precio() {
  return (
    <Seccion id="precio" oscura>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[22px] font-extrabold leading-snug text-white sm:text-[28px]">
          {PRECIO_DESDE
            ? `Instalación gratis y 14 días de prueba. Después, desde ${PRECIO_DESDE} al mes.`
            : "Instalamos pocos negocios al mes porque lo hacemos en persona. Pregúntenos por los cupos."}
        </p>
        <BotonWhatsApp origen="precios" className="mt-8 w-full sm:w-auto" />
      </div>
    </Seccion>
  );
}
