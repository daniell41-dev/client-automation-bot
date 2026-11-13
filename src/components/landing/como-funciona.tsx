import { Pasos } from "@/components/landing/pasos";
import { Seccion } from "@/components/landing/seccion";

export function ComoFunciona() {
  return (
    <Seccion id="como-funciona" titulo="Así funciona" oscura>
      <Pasos
        oscura
        pasos={[
          "Su cliente escribe o manda una nota de voz.",
          "Nexo arma el pedido con sus precios y el cliente confirma el total.",
          "Nexo revisa el comprobante: monto, cuenta, referencia y fecha. Si algo no cuadra, le avisa.",
          "Usted aprueba con un botón y el cliente recibe su número de pedido.",
        ]}
      />
    </Seccion>
  );
}
