/**
 * T-70: términos del servicio. Dejan por escrito lo que el producto ya hace
 * así: Nexo alerta sobre comprobantes, pero quien aprueba un pago es el
 * negocio, después de revisar su banco; sin permanencia; prueba de 14 días.
 */

import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { BloqueResponsable } from "@/components/bloque-responsable";
import { CONTACTO_LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Términos del servicio",
  description: "Condiciones de uso de Nexo para los negocios.",
};

export default function TerminosPage() {
  return (
    <PaginaLegal titulo="Términos del servicio">
      <p>
        Estos términos regulan el uso de Nexo por parte de los negocios. Al crear una cuenta o usar el servicio,
        el negocio los acepta.
      </p>

      <h2>1. Quién presta el servicio</h2>
      <BloqueResponsable />

      <h2>2. Qué es Nexo</h2>
      <p>
        Nexo es un asistente que atiende el WhatsApp del negocio: responde a sus clientes con la información que
        el negocio carga (catálogo, precios, horarios, formas de pago), arma pedidos y citas, lee los
        comprobantes de pago y le avisa al negocio para que apruebe. Incluye un portal para configurar el
        asistente y ver pedidos, conversaciones y citas.
      </p>

      <h2>3. Cuenta y acceso</h2>
      <ul>
        <li>Las cuentas las crea Nexo para cada negocio. El negocio cuida su contraseña y responde por lo que se haga con su cuenta.</li>
        <li>El negocio debe darnos información verdadera y mantenerla al día.</li>
      </ul>

      <h2>4. Prueba, precio y pago</h2>
      <ul>
        <li>Los primeros 14 días son de prueba gratis, sin obligación de continuar.</li>
        <li>Después, el servicio se paga mes a mes por adelantado, según el plan acordado con el negocio. No hay permanencia mínima.</li>
        <li>Si un pago no llega, podemos pausar el asistente hasta que se ponga al día. Los datos no se borran por eso.</li>
        <li>Avisaremos con al menos 30 días cualquier cambio de precio.</li>
        <li>Los costos que Meta cobre por los mensajes de WhatsApp se informan aparte si superan lo incluido en el plan.</li>
      </ul>

      <h2>5. Lo que le toca al negocio</h2>
      <ul>
        <li>
          <strong>Verificar los pagos en su banco antes de aprobar un pedido.</strong> Nexo lee los comprobantes y
          avisa si algo no coincide, pero una imagen se puede falsificar: la decisión de aprobar o rechazar es
          siempre del negocio.
        </li>
        <li>Mantener al día el catálogo, los precios, los horarios y las cuentas de pago.</li>
        <li>Hacer las devoluciones de dinero que correspondan. Nexo ayuda a llevar la cuenta, pero no mueve dinero.</li>
        <li>Informar a sus clientes sobre el tratamiento de sus datos y contar con su autorización (ver la <Link href="/privacidad">política de privacidad</Link>).</li>
        <li>Cumplir las políticas de WhatsApp Business y de Meta, y la ley colombiana en su actividad comercial.</li>
      </ul>

      <h2>6. Lo que le toca a Nexo</h2>
      <ul>
        <li>Mantener el servicio funcionando y corregir los errores que se encuentren.</li>
        <li>Proteger los datos según la <Link href="/privacidad">política de privacidad</Link>.</li>
        <li>Dar soporte por WhatsApp o correo en días hábiles.</li>
      </ul>

      <h2>7. Disponibilidad y límites</h2>
      <p>
        Hacemos lo posible para que Nexo funcione todo el tiempo, pero depende de servicios de terceros (Meta,
        proveedores de inteligencia artificial, servidores) que pueden fallar. El asistente usa inteligencia
        artificial y puede equivocarse al entender un mensaje; por eso todo pedido pasa por un resumen que el
        cliente confirma y por la aprobación del negocio.
      </p>
      <p>
        Nexo no responde por pérdidas que vengan de aprobar un pago sin verificarlo, de información desactualizada
        cargada por el negocio, ni de fallas de servicios de terceros. En cualquier caso, nuestra
        responsabilidad máxima frente al negocio es el valor pagado por el servicio en los últimos tres meses.
      </p>

      <h2>8. Uso no permitido</h2>
      <p>
        No se permite usar Nexo para enviar spam, engañar a los clientes, vender productos prohibidos ni infringir
        derechos de terceros. Si eso pasa, podemos suspender la cuenta.
      </p>

      <h2>9. Cancelación</h2>
      <p>
        El negocio puede cancelar cuando quiera escribiéndonos a{" "}
        <a href={`mailto:${CONTACTO_LEGAL.correo}`}>{CONTACTO_LEGAL.correo}</a> o por WhatsApp. El servicio sigue hasta
        el final del mes pagado. Después, si el negocio lo pide, borramos sus datos según la{" "}
        <Link href="/eliminar-datos">página de borrado</Link>.
      </p>

      <h2>10. Cambios</h2>
      <p>
        Podemos actualizar estos términos. Publicaremos la nueva versión aquí con su fecha y avisaremos a los
        negocios de los cambios importantes con al menos 15 días.
      </p>

      <h2>11. Ley y jurisdicción</h2>
      <p>
        Estos términos se rigen por la ley colombiana. Cualquier diferencia se intentará resolver primero por
        conversación directa; si no se logra, se resolverá ante los jueces de Cúcuta.
      </p>
    </PaginaLegal>
  );
}
