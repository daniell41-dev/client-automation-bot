/**
 * T-70: instrucciones para borrar datos. Meta pide esta URL ("instrucciones
 * de eliminación de datos de usuario") para publicar la app; va aparte de la
 * política para que el enlace lleve directo a los pasos.
 */

import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { BloqueResponsable } from "@/components/bloque-responsable";
import { CONTACTO_LEGAL } from "@/lib/legal";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (legal.eliminarDatos). */
const tt = textos.legal.eliminarDatos;

export const metadata = {
  title: tt.eliminarMisDatos,
  description: tt.comoPedirQueAurela,
};

export default function EliminarDatosPage() {
  return (
    <PaginaLegal titulo={tt.comoPedirQueBorremos}>
      <p>{tt.puedePedirEnCualquier}</p>

      <h2>{tt.pasos}</h2>
      <ol>
        <li>{tt.escribanosA}<a href={`mailto:${CONTACTO_LEGAL.correo}`}>{CONTACTO_LEGAL.correo}</a>{tt.oPorWhatsappA}{" "}
          {CONTACTO_LEGAL.telefonos.join(tt.o)}{tt.conElAsunto}<strong>{tt.eliminarMisDatos2}</strong>.
        </li>
        <li>{tt.indiqueSuNombreY}</li>
        <li>{tt.paraConfirmarQueEs}</li>
        <li>{tt.borramosSusDatosY}</li>
      </ol>

      <h2>{tt.queSeBorra}</h2>
      <ul>
        <li>{tt.clientesSuNombreNumero}</li>
        <li>{tt.negociosLaCuentaDel}</li>
      </ul>
      <p>{tt.podemosConservarLoQue}</p>

      <h2>{tt.responsables}</h2>
      <BloqueResponsable />
      <p>{tt.masDetallesEnLa}<Link href="/privacidad">{tt.politicaDePrivacidad}</Link>.
      </p>
    </PaginaLegal>
  );
}
