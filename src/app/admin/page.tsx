/**
 * /admin quedó deprecado: la vista de leads vive ahora en el back office
 * (con autenticación y rol admin). Se mantiene la ruta por compatibilidad.
 */

import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/backoffice/leads");
}
