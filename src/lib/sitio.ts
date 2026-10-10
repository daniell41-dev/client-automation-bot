/**
 * URL pública del sitio (T-41), para armar los links de los correos de
 * invitación y de "olvidé mi contraseña". `NEXT_PUBLIC_SITE_URL` manda en
 * producción; sin ella se usa el origen de la request, así funciona igual en
 * local (`http://localhost:3000`) y en un túnel (ngrok).
 */

import { headers } from "next/headers";

export async function urlDelSitio(): Promise<string> {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurada) return configurada.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/** Link al que vuelve el usuario desde el correo: confirma y lo manda a definir su contraseña. */
export async function linkDefinirContrasena(): Promise<string> {
  return `${await urlDelSitio()}/auth/confirm?next=/cuenta/contrasena`;
}
