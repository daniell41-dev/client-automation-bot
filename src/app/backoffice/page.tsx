/**
 * /backoffice → la sección principal es Negocios.
 */

import { redirect } from "next/navigation";

export default function BackofficeHome() {
  redirect("/backoffice/negocios");
}

// T-71: el nombre de la pestaña ("Back office · Nexo"); la plantilla vive en el layout raíz.
export const metadata = { title: "Back office" };
