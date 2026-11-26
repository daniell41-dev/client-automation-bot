/**
 * T-70: política de tratamiento de datos personales (Ley 1581 de 2012 y
 * Decreto 1377 de 2013). Meta la exige para publicar la app de WhatsApp.
 *
 * Distingue dos roles a propósito: con los datos de las cuentas del portal,
 * Aurela es responsable; con los datos de los clientes de cada negocio, el
 * responsable es el negocio y Aurela es encargado (los trata por cuenta de
 * él). Describe lo que el sistema guarda de verdad (ver la base de datos):
 * si cambia lo que se guarda, esta página tiene que cambiar también.
 */

import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { BloqueResponsable } from "@/components/bloque-responsable";
import { CONTACTO_LEGAL } from "@/lib/legal";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (legal.privacidad). */
const tt = textos.legal.privacidad;

export const metadata = {
  title: tt.politicaDePrivacidad,
  description: tt.comoAurelaTrataLos,
};

export default function PrivacidadPage() {
  return (
    <PaginaLegal titulo={tt.politicaDePrivacidadY}>
      <p>{tt.aurelaEsUnServicio}</p>

      <h2 id="responsable">{tt.t1QuienEsEl}</h2>
      <BloqueResponsable />

      <h2 id="roles">{tt.t2DosTiposDe}</h2>
      <ul>
        <li>
          <strong>{tt.datosDeLosNegocios}</strong>{tt.laDuenaOEl}{" "}
          <strong>{tt.responsable}</strong>{tt.deSuTratamiento}</li>
        <li>
          <strong>{tt.datosDeLosClientes}</strong>{tt.lasPersonasQueLe}{" "}
          <strong>{tt.responsableEsElNegocio}</strong>{tt.yAurelaActuaComo}<strong>{tt.encargado}</strong>{tt.esDecirTrataEsos}</li>
      </ul>

      <h2 id="que-datos">{tt.t3QueDatosTratamos}</h2>
      <h3>{tt.deLosNegocios}</h3>
      <ul>
        <li>{tt.correoElectronicoYRol}</li>
        <li>{tt.datosDelNegocioNombre}</li>
        <li>{tt.registrosDeUsoDel}</li>
      </ul>
      <h3>{tt.deLosClientesDe}</h3>
      <ul>
        <li>{tt.numeroDeWhatsappY}</li>
        <li>{tt.losMensajesDeLa}</li>
        <li>{tt.losPedidosYCitas}</li>
        <li>{tt.losComprobantesDePago}</li>
        <li>{tt.siUnPedidoRechazado}</li>
      </ul>
      <p>{tt.noTratamosDatosSensibles}</p>

      <h2 id="para-que">{tt.t4ParaQueLos}</h2>
      <ul>
        <li>{tt.responderALosClientes}</li>
        <li>{tt.revisarComprobantesDePago}</li>
        <li>{tt.avisarleAlNegocioDe}</li>
        <li>{tt.coordinarDevolucionesDeDinero}</li>
        <li>{tt.darAccesoSeguroAl}</li>
      </ul>
      <p>{tt.noVendemosDatosPersonales}</p>

      <h2 id="autorizacion">{tt.t5Autorizacion}</h2>
      <p>{tt.alEscribirleAlWhatsapp}{" "}
        <Link href="/terminos">{tt.terminosDelServicio}</Link>.
      </p>

      <h2 id="proveedores">{tt.t6ConQuienCompartimos}</h2>
      <p>{tt.usamosProveedoresQueTratan}</p>
      <table>
        <thead>
          <tr><th>{tt.proveedor}</th><th>{tt.paraQue}</th></tr>
        </thead>
        <tbody>
          <tr><td>{tt.metaWhatsappBusinessPlatform}</td><td>{tt.recibirYEnviarLos}</td></tr>
          <tr><td>{tt.supabase}</td><td>{tt.baseDeDatosArchivos}</td></tr>
          <tr><td>{tt.googleGeminiYGroq}</td><td>{tt.inteligenciaArtificialQueEntiende}</td></tr>
          <tr><td>{tt.proveedorDeServidoresEn}</td><td>{tt.ejecutarLaAplicacion}</td></tr>
          <tr><td>{tt.wompiSoloSiEl}</td><td>{tt.cobrosEnLinea}</td></tr>
        </tbody>
      </table>
      <p>{tt.tambienPodemosEntregarDatos}</p>

      <h2 id="transferencia">{tt.t7DondeSeGuardan}</h2>
      <p>{tt.losDatosSeGuardan}</p>

      <h2 id="seguridad">{tt.t8ComoLosProtegemos}</h2>
      <ul>
        <li>{tt.conexionesCifradasHttpsY}</li>
        <li>{tt.cadaNegocioSoloPuede}</li>
        <li>{tt.lasFotosDeComprobantes}</li>
        <li>{tt.lasLlavesDeAcceso}</li>
      </ul>

      <h2 id="cuanto-tiempo">{tt.t9CuantoTiempoLos}</h2>
      <p>{tt.guardamosLosDatosMientras}</p>

      <h2 id="derechos">{tt.t10SusDerechos}</h2>
      <p>{tt.comoTitularDeLos}</p>
      <ul>
        <li>{tt.conocerActualizarYCorregir}</li>
        <li>{tt.pedirPruebaDeLa}</li>
        <li>{tt.saberComoSeHan}</li>
        <li>{tt.revocarLaAutorizacionY}</li>
        <li>{tt.presentarQuejasAnteLa}</li>
        <li>{tt.accederGratisASus}</li>
      </ul>

      <h2 id="como-ejercerlos">{tt.t11ComoEjercerlos}</h2>
      <p>{tt.escribanosA}<a href={`mailto:${CONTACTO_LEGAL.correo}`}>{CONTACTO_LEGAL.correo}</a>{tt.oPorWhatsappA}{" "}
        {CONTACTO_LEGAL.telefonos.join(tt.o)}{tt.conSuNombreSu}</p>
      <ul>
        <li><strong>{tt.consultas}</strong>{tt.queDatosTenemosY}</li>
        <li><strong>{tt.reclamos}</strong>{tt.corregirActualizarOBorrar}</li>
      </ul>
      <p>{tt.paraPedirQueBorremos}<Link href="/eliminar-datos">{tt.eliminarMisDatos}</Link>.
      </p>

      <h2 id="cookies">{tt.t12Cookies}</h2>
      <p>{tt.elPortalUsaSolo}</p>

      <h2 id="cambios">{tt.t13CambiosAEsta}</h2>
      <p>{tt.siCambiamosEstaPolitica}</p>
    </PaginaLegal>
  );
}
