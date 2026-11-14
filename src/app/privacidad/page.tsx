/**
 * T-70: política de tratamiento de datos personales (Ley 1581 de 2012 y
 * Decreto 1377 de 2013). Meta la exige para publicar la app de WhatsApp.
 *
 * Distingue dos roles a propósito: con los datos de las cuentas del portal,
 * Nexo es responsable; con los datos de los clientes de cada negocio, el
 * responsable es el negocio y Nexo es encargado (los trata por cuenta de
 * él). Describe lo que el sistema guarda de verdad (ver la base de datos):
 * si cambia lo que se guarda, esta página tiene que cambiar también.
 */

import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { BloqueResponsable } from "@/components/bloque-responsable";
import { CONTACTO_LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Política de privacidad",
  description: "Cómo Nexo trata los datos personales de los negocios y de sus clientes.",
};

export default function PrivacidadPage() {
  return (
    <PaginaLegal titulo="Política de privacidad y tratamiento de datos" actualizado="14 de noviembre de 2026">
      <p>
        Nexo es un servicio que atiende el WhatsApp de negocios: responde a sus clientes, arma pedidos y citas,
        revisa comprobantes de pago y le avisa al negocio para que apruebe. Esta política explica qué datos
        personales tratamos, para qué, con quién los compartimos y cómo puede ejercer sus derechos, conforme a
        la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas de protección de datos en Colombia.
      </p>

      <h2 id="responsable">1. Quién es el responsable</h2>
      <BloqueResponsable />

      <h2 id="roles">2. Dos tipos de datos, dos roles</h2>
      <ul>
        <li>
          <strong>Datos de los negocios que usan Nexo</strong> (la dueña o el dueño y su equipo): Nexo es el{" "}
          <strong>responsable</strong> de su tratamiento.
        </li>
        <li>
          <strong>Datos de los clientes de cada negocio</strong> (las personas que le escriben por WhatsApp): el{" "}
          <strong>responsable es el negocio</strong>, y Nexo actúa como <strong>encargado</strong>, es decir, trata
          esos datos solo por cuenta del negocio y para prestarle el servicio. Si usted es cliente de un negocio,
          también puede dirigirse directamente a ese negocio.
        </li>
      </ul>

      <h2 id="que-datos">3. Qué datos tratamos</h2>
      <h3>De los negocios</h3>
      <ul>
        <li>Correo electrónico y rol de acceso al portal. La contraseña la guarda nuestro proveedor de autenticación cifrada; nadie en Nexo puede leerla.</li>
        <li>Datos del negocio: nombre, catálogo o menú, precios, horarios, costo de domicilio, mensajes del asistente, número de WhatsApp conectado y cuentas para recibir pagos.</li>
        <li>Registros de uso del servicio: cantidad de mensajes y de consultas a la inteligencia artificial, para medir costos.</li>
      </ul>
      <h3>De los clientes de cada negocio</h3>
      <ul>
        <li>Número de WhatsApp y el nombre que la persona da en la conversación.</li>
        <li>Los mensajes de la conversación con el asistente. Las notas de voz se convierten en texto y el audio no se guarda.</li>
        <li>Los pedidos y citas: productos, totales, forma de entrega, dirección de entrega y fecha.</li>
        <li>Los comprobantes de pago: la imagen enviada y lo que se lee de ella (banco, referencia, monto, fecha).</li>
        <li>Si un pedido rechazado requiere devolución, la cuenta que la persona indique para recibirla.</li>
      </ul>
      <p>
        No tratamos datos sensibles ni pedimos datos de tarjetas. Si un negocio cobra con una pasarela de pagos
        como Wompi, los datos de la tarjeta los maneja esa pasarela. Las fotos de productos que alguien envía
        para preguntar se analizan y se descartan; solo se guardan las de comprobantes de pago.
      </p>

      <h2 id="para-que">4. Para qué los usamos</h2>
      <ul>
        <li>Responder a los clientes de cada negocio, tomar sus pedidos y agendar sus citas.</li>
        <li>Revisar comprobantes de pago y alertar al negocio cuando algo no coincide, para prevenir fraudes.</li>
        <li>Avisarle al negocio de cada pedido y avisarle al cliente cuando su pedido se aprueba, está listo o se rechaza.</li>
        <li>Coordinar devoluciones de dinero cuando un pedido se rechaza.</li>
        <li>Dar acceso seguro al portal, dar soporte y medir el uso para facturar y mejorar el servicio.</li>
      </ul>
      <p>
        No vendemos datos personales ni los usamos para publicidad de terceros. Un negocio nunca puede ver los
        datos de otro negocio.
      </p>

      <h2 id="autorizacion">5. Autorización</h2>
      <p>
        Al escribirle al WhatsApp de un negocio que usa Nexo, la persona entrega sus datos para que ese negocio
        la atienda. Cada negocio es responsable de informar a sus clientes y de contar con su autorización,
        y puede enlazar esta política para explicar cómo se tratan los datos. Los negocios autorizan el
        tratamiento de sus propios datos al crear su cuenta y aceptar los{" "}
        <Link href="/terminos">términos del servicio</Link>.
      </p>

      <h2 id="proveedores">6. Con quién compartimos los datos</h2>
      <p>Usamos proveedores que tratan datos por cuenta nuestra, solo para prestar el servicio:</p>
      <table>
        <thead>
          <tr><th>Proveedor</th><th>Para qué</th></tr>
        </thead>
        <tbody>
          <tr><td>Meta (WhatsApp Business Platform)</td><td>Recibir y enviar los mensajes de WhatsApp.</td></tr>
          <tr><td>Supabase</td><td>Base de datos, archivos y autenticación del portal.</td></tr>
          <tr><td>Google (Gemini) y Groq</td><td>Inteligencia artificial que entiende los mensajes, las notas de voz y los comprobantes para responder.</td></tr>
          <tr><td>Proveedor de servidores en la nube</td><td>Ejecutar la aplicación.</td></tr>
          <tr><td>Wompi (solo si el negocio lo activa)</td><td>Cobros en línea.</td></tr>
          <tr><td>Microsoft (Clarity), solo si el visitante lo acepta</td><td>Medir cómo se usa la página de presentación de Nexo (ver la sección 12).</td></tr>
        </tbody>
      </table>
      <p>
        También podemos entregar datos a una autoridad cuando una ley o una orden judicial lo exija.
      </p>

      <h2 id="transferencia">7. Dónde se guardan</h2>
      <p>
        Los datos se guardan en servidores ubicados en Estados Unidos. Esto implica una transferencia
        internacional de datos, que hacemos con proveedores que aplican medidas de seguridad reconocidas. Al
        usar el servicio, los negocios y sus clientes autorizan esa transferencia.
      </p>

      <h2 id="seguridad">8. Cómo los protegemos</h2>
      <ul>
        <li>Conexiones cifradas (HTTPS) y contraseñas cifradas.</li>
        <li>Cada negocio solo puede ver sus propios datos; la base de datos lo bloquea, no solo la pantalla.</li>
        <li>Las fotos de comprobantes se guardan en un espacio privado y solo se ven con enlaces que vencen en una hora.</li>
        <li>Las llaves de acceso a WhatsApp y a la inteligencia artificial se guardan en el servidor, nunca en la base de datos.</li>
      </ul>

      <h2 id="cuanto-tiempo">9. Cuánto tiempo los guardamos</h2>
      <p>
        Guardamos los datos mientras el negocio use Nexo y durante el tiempo necesario para cumplir obligaciones
        legales o atender reclamos. El historial de la conversación con el asistente se reinicia cuando el
        cliente vuelve después de 24 horas sin escribir. Cuando un negocio cancela el servicio, o cuando alguien
        pide borrar sus datos, los eliminamos según la sección siguiente.
      </p>

      <h2 id="derechos">10. Sus derechos</h2>
      <p>Como titular de los datos, usted puede:</p>
      <ul>
        <li>Conocer, actualizar y corregir sus datos.</li>
        <li>Pedir prueba de la autorización que dio.</li>
        <li>Saber cómo se han usado sus datos.</li>
        <li>Revocar la autorización y pedir que se borren sus datos, salvo que una ley obligue a conservarlos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
        <li>Acceder gratis a sus datos.</li>
      </ul>

      <h2 id="como-ejercerlos">11. Cómo ejercerlos</h2>
      <p>
        Escríbanos a <a href={`mailto:${CONTACTO_LEGAL.correo}`}>{CONTACTO_LEGAL.correo}</a> o por WhatsApp a{" "}
        {CONTACTO_LEGAL.telefonos.join(" o ")}, con su nombre, su número de WhatsApp y lo que pide. Si es cliente de
        un negocio, díganos también el nombre del negocio.
      </p>
      <ul>
        <li><strong>Consultas</strong> (qué datos tenemos y cómo se usan): respondemos en máximo 10 días hábiles.</li>
        <li><strong>Reclamos</strong> (corregir, actualizar o borrar): respondemos en máximo 15 días hábiles.</li>
      </ul>
      <p>
        Para pedir que borremos sus datos, siga los pasos de <Link href="/eliminar-datos">eliminar mis datos</Link>.
      </p>

      <h2 id="cookies">12. Cookies y medición de la página</h2>
      <p>
        El portal usa solo las cookies necesarias para mantener la sesión iniciada. No usamos cookies de
        publicidad.
      </p>
      {/* T-90: párrafo nuevo, pendiente de revisión del responsable. Describe lo
          que hace `AvisoMedicion`: si cambia qué se mide o dónde, cambia aquí. */}
      <p id="medicion">
        En la página de presentación de Nexo, y solo si usted toca <strong>Aceptar</strong> en el aviso que
        aparece al entrar, usamos <strong>Microsoft Clarity</strong>, una herramienta de Microsoft, para ver
        cómo se usa la página y mejorarla: qué secciones se leen, hasta dónde se baja, dónde se toca y cuántas
        veces se tocan los botones de WhatsApp. Clarity registra esa navegación sin su nombre ni su número de
        teléfono y usa sus propias cookies para reconocer visitas repetidas. No la usamos en el portal, en la
        demo ni en el inicio de sesión, y no la usamos para publicidad. Si elige <strong>No, gracias</strong>,
        la herramienta no se carga. Su decisión queda guardada en su navegador; para cambiarla, borre los datos
        de este sitio en el navegador y el aviso volverá a aparecer. Microsoft trata esos datos como encargado,
        según su propia declaración de privacidad.
      </p>

      <h2 id="cambios">13. Cambios a esta política</h2>
      <p>
        Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha. Si el cambio es
        importante, se lo avisaremos a los negocios por correo o por WhatsApp antes de que aplique.
      </p>
    </PaginaLegal>
  );
}
