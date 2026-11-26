import Link from "next/link";
import { PantallaError, botonPrincipal, botonSecundario } from "@/components/pantalla-error";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (errores.noEncontrada). */
const tt = textos.errores.noEncontrada;

export const metadata = { title: textos.titulosPestana.noEncontrada };

/** T-72: un link viejo, un negocio que ya no es tuyo o una dirección mal escrita. */
export default function NotFound() {
  return (
    <PantallaError
      codigo="404"
      titulo={tt.noEncontramosEstaPagina}
      texto={tt.puedeQueElEnlace}
    >
      <Link href="/portal" className={botonPrincipal}>{tt.irAMisNegocios}</Link>
      <Link href="/" className={botonSecundario}>{tt.irAlInicio}</Link>
    </PantallaError>
  );
}
