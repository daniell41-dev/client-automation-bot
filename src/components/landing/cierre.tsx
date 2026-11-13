import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";
import { Seccion } from "@/components/landing/seccion";

export function Cierre() {
  return (
    <Seccion id="cierre" oscura>
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="cierre-titulo" className="text-[28px] font-extrabold leading-tight text-white sm:text-[38px]">
          ¿Quiere verlo funcionando con su negocio?
        </h2>
        <BotonWhatsApp origen="cierre" className="mt-8 w-full sm:w-auto" />
      </div>
    </Seccion>
  );
}
