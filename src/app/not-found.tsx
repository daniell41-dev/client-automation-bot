import Link from "next/link";
import { PantallaError, botonPrincipal, botonSecundario } from "@/components/pantalla-error";

export const metadata = { title: "Página no encontrada" };

/** T-72: un link viejo, un negocio que ya no es tuyo o una dirección mal escrita. */
export default function NotFound() {
  return (
    <PantallaError
      codigo="404"
      titulo="No encontramos esta página"
      texto="Puede que el enlace esté mal escrito o que la página ya no exista. Si buscaba uno de sus negocios, entre desde su lista."
    >
      <Link href="/portal" className={botonPrincipal}>
        Ir a mis negocios
      </Link>
      <Link href="/" className={botonSecundario}>
        Ir al inicio
      </Link>
    </PantallaError>
  );
}
