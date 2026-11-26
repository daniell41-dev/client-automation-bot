/**
 * T-70: términos del servicio. Dejan por escrito lo que el producto ya hace
 * así: Aurela alerta sobre comprobantes, pero quien aprueba un pago es el
 * negocio, después de revisar su banco; sin permanencia; prueba de 14 días.
 */

import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { BloqueResponsable } from "@/components/bloque-responsable";
import { CONTACTO_LEGAL } from "@/lib/legal";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (legal.terminos). */
const tt = textos.legal.terminos;

export const metadata = {
  title: tt.terminosDelServicio,
  description: tt.condicionesDeUsoDe,
};

export default function TerminosPage() {
  return (
    <PaginaLegal titulo={tt.terminosDelServicio}>
      <p>{tt.estosTerminosRegulanEl}</p>

      <h2>{tt.t1QuienPrestaEl}</h2>
      <BloqueResponsable />

      <h2>{tt.t2QueEsAurela}</h2>
      <p>{tt.aurelaEsUnAsistente}</p>

      <h2>{tt.t3CuentaYAcceso}</h2>
      <ul>
        <li>{tt.lasCuentasLasCrea}</li>
        <li>{tt.elNegocioDebeDarnos}</li>
      </ul>

      <h2>{tt.t4PruebaPrecioY}</h2>
      <ul>
        <li>{tt.losPrimeros14Dias}</li>
        <li>{tt.despuesElServicioSe}</li>
        <li>{tt.siUnPagoNo}</li>
        <li>{tt.avisaremosConAlMenos}</li>
        <li>{tt.losCostosQueMeta}</li>
      </ul>

      <h2>{tt.t5LoQueLe}</h2>
      <ul>
        <li>
          <strong>{tt.verificarLosPagosEn}</strong>{tt.aurelaLeeLosComprobantes}</li>
        <li>{tt.mantenerAlDiaEl}</li>
        <li>{tt.hacerLasDevolucionesDe}</li>
        <li>{tt.informarASusClientes}<Link href="/privacidad">{tt.politicaDePrivacidad}</Link>).</li>
        <li>{tt.cumplirLasPoliticasDe}</li>
      </ul>

      <h2>{tt.t6LoQueLe}</h2>
      <ul>
        <li>{tt.mantenerElServicioFuncionando}</li>
        <li>{tt.protegerLosDatosSegun}<Link href="/privacidad">{tt.politicaDePrivacidad}</Link>.</li>
        <li>{tt.darSoportePorWhatsapp}</li>
      </ul>

      <h2>{tt.t7DisponibilidadYLimites}</h2>
      <p>{tt.hacemosLoPosiblePara}</p>
      <p>{tt.aurelaNoRespondePor}</p>

      <h2>{tt.t8UsoNoPermitido}</h2>
      <p>{tt.noSePermiteUsar}</p>

      <h2>{tt.t9Cancelacion}</h2>
      <p>{tt.elNegocioPuedeCancelar}{" "}
        <a href={`mailto:${CONTACTO_LEGAL.correo}`}>{CONTACTO_LEGAL.correo}</a>{tt.oPorWhatsappEl}{" "}
        <Link href="/eliminar-datos">{tt.paginaDeBorrado}</Link>.
      </p>

      <h2>{tt.t10Cambios}</h2>
      <p>{tt.podemosActualizarEstosTerminos}</p>

      <h2>{tt.t11LeyYJurisdiccion}</h2>
      <p>{tt.estosTerminosSeRigen}</p>
    </PaginaLegal>
  );
}
