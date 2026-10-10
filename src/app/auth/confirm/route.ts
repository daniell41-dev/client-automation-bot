/**
 * Vuelta desde los correos de Supabase Auth (T-41): invitación y "olvidé mi
 * contraseña". Canjea el token del link por una sesión (cookies) y manda al
 * usuario a `next` — por defecto, a definir su contraseña.
 *
 * Acepta las dos formas en que Supabase arma el link: `token_hash` + `type`
 * (plantilla de correo recomendada para SSR, ver docs/08-supabase-saas.md) y
 * `code` (flujo PKCE por defecto). Un link vencido o ya usado vuelve al login
 * con un aviso, nunca a una pantalla rota.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase/server";
import { destinoSeguro } from "@/app/login/destino";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const destino = destinoSeguro(url.searchParams.get("next") ?? "") ?? "/cuenta/contrasena";

  const supabase = await createUserClient();
  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    const login = new URL("/login", url);
    login.searchParams.set("error", "link");
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(new URL(destino, url));
}
