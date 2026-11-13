import { Pasos } from "@/components/landing/pasos";
import { Seccion } from "@/components/landing/seccion";

export function Instalacion() {
  return (
    <Seccion id="instalacion" titulo="Cómo es la instalación">
      <Pasos
        pasos={[
          "Usted nos pasa su menú o servicios, precios y horarios.",
          "Nosotros cargamos todo y conectamos el WhatsApp del negocio.",
          "Hacemos un pedido de prueba juntos y le enseñamos a aprobar.",
        ]}
      />
    </Seccion>
  );
}
