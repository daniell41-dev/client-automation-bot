/**
 * T-86: si ya hay responsable con nombre y foto, el cierre muestra su cara
 * junto al botón: el último paso es escribirle a una persona, no a una marca.
 * Sin responsable, el cierre queda como antes.
 */

import Image from "next/image";
import { RESPONSABLE, type Responsable as DatosResponsable } from "@/app/landing-config";
import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";
import { responsableVisible } from "@/components/landing/responsable";
import { Seccion } from "@/components/landing/seccion";
import { existeEnPublic } from "@/lib/archivo-publico";

export function Cierre({
  responsable = RESPONSABLE,
  hayFoto = existeEnPublic(RESPONSABLE.foto),
}: {
  responsable?: DatosResponsable;
  hayFoto?: boolean;
}) {
  const conPersona = responsableVisible(responsable, hayFoto);

  return (
    <Seccion id="cierre" oscura>
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="cierre-titulo" className="text-[28px] font-extrabold leading-tight text-white sm:text-[38px]">
          ¿Quiere verlo funcionando con su negocio?
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <BotonWhatsApp origen="cierre" className="w-full sm:w-auto" />
          {conPersona && (
            <p className="flex items-center gap-3 text-[15px] font-semibold text-white/85">
              <Image
                src={responsable.foto}
                alt=""
                width={96}
                height={96}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-white/20"
              />
              Le responde {responsable.nombre}.
            </p>
          )}
        </div>
      </div>
    </Seccion>
  );
}
