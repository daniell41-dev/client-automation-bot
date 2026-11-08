/**
 * T-70: instrucciones para borrar datos. Meta pide esta URL ("instrucciones
 * de eliminación de datos de usuario") para publicar la app; va aparte de la
 * política para que el enlace lleve directo a los pasos.
 */

import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { BloqueResponsable } from "@/components/bloque-responsable";
import { CONTACTO_LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Eliminar mis datos",
  description: "Cómo pedir que Nexo borre sus datos personales.",
};

export default function EliminarDatosPage() {
  return (
    <PaginaLegal titulo="Cómo pedir que borremos sus datos">
      <p>
        Puede pedir en cualquier momento que borremos sus datos personales, sea usted cliente de un negocio que
        usa Nexo o la dueña o el dueño de un negocio.
      </p>

      <h2>Pasos</h2>
      <ol>
        <li>
          Escríbanos a <a href={`mailto:${CONTACTO_LEGAL.correo}`}>{CONTACTO_LEGAL.correo}</a> o por WhatsApp a{" "}
          {CONTACTO_LEGAL.telefonos.join(" o ")}, con el asunto <strong>&quot;Eliminar mis datos&quot;</strong>.
        </li>
        <li>
          Indique su nombre y el número de WhatsApp con el que habló. Si es cliente, díganos también el nombre del
          negocio.
        </li>
        <li>
          Para confirmar que es usted, le escribiremos a ese mismo número de WhatsApp. Así nadie puede pedir el
          borrado de los datos de otra persona.
        </li>
        <li>Borramos sus datos y le confirmamos por el mismo medio en máximo 15 días hábiles.</li>
      </ol>

      <h2>Qué se borra</h2>
      <ul>
        <li>Clientes: su nombre, número, conversaciones, direcciones, comprobantes de pago y cuentas de devolución.</li>
        <li>Negocios: la cuenta del portal y todos los datos del negocio y de sus clientes.</li>
      </ul>
      <p>
        Podemos conservar lo que una ley nos obligue a guardar, por ejemplo registros contables de pagos, solo
        durante el tiempo exigido y sin usarlo para nada más.
      </p>

      <h2>Responsables</h2>
      <BloqueResponsable />
      <p>
        Más detalles en la <Link href="/privacidad">política de privacidad</Link>.
      </p>
    </PaginaLegal>
  );
}
