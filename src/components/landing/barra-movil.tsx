import { BotonWhatsApp } from "@/components/landing/boton-whatsapp";

/**
 * T-80: en el celular (donde llega casi todo el tráfico) el botón queda fijo
 * abajo, al alcance del pulgar, sin tener que volver al hero. Desde `sm` hay
 * espacio para los botones de cada sección y la barra sobra.
 */
export function BarraMovil() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0E2033]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
      <BotonWhatsApp origen="barra-movil" className="w-full shadow-none" />
    </div>
  );
}
