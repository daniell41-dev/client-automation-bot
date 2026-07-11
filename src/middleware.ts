/**
 * Middleware: protege /portal y /backoffice.
 *
 * Solo verifica que haya sesión (y la refresca); si no la hay, redirige a
 * /login conservando el destino en ?next=. El chequeo de rol (admin vs
 * cliente) vive en los layouts de cada sección.
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, hasUser } = await updateSession(request);

  if (!hasUser) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/portal/:path*", "/backoffice/:path*"],
};
