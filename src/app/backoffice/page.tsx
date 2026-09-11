/**
 * /backoffice → la sección principal es Negocios.
 */

import { redirect } from "next/navigation";

export default function BackofficeHome() {
  redirect("/backoffice/negocios");
}
