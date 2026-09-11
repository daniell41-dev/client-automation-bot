/**
 * Helper de sesión para el middleware de Next.
 *
 * Refresca el token de Supabase en cada request protegida y devuelve el
 * usuario (o null). El chequeo de ROL no vive aquí (eso lo hacen los layouts
 * de /portal y /backoffice) para no pagar una query a DB por request.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  hasUser: boolean;
}> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Sin Supabase configurado no hay auth: se deja pasar (modo desarrollo).
  if (!url || !anonKey) return { response, hasUser: false };

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, hasUser: user !== null };
}
