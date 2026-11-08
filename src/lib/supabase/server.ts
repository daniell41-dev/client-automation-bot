/**
 * Cliente Supabase para Server Components y Server Actions.
 *
 * Usa las cookies de Next para el contexto del usuario autenticado: todas las
 * queries hechas con este cliente pasan por RLS con la identidad del usuario.
 * Es la vía por defecto del portal y el back office (defensa en profundidad:
 * aunque una action tenga un bug, RLS limita lo que puede tocar).
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createUserClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component (no puede escribir cookies):
            // el middleware se encarga del refresh de sesión.
          }
        },
      },
    },
  );
}

/**
 * Rol del usuario autenticado, o `null` si no hay sesión.
 *
 * T-69: cada pantalla del portal lo pedía tres veces (layout del portal,
 * layout del negocio y la página o la acción), y cada vez eran dos viajes a
 * Supabase. Con `cache` se calcula una sola vez por request.
 *
 * `getClaims` en vez de `getUser`: verifica el token con la clave pública
 * del proyecto sin ir al servidor de Auth (si el proyecto usa claves de
 * firma asimétricas; si no, hace lo mismo que `getUser`). Es lo que
 * recomienda Supabase para el servidor, y la identidad sigue verificada.
 */
export const getUserRole = cache(async (): Promise<{
  userId: string;
  email: string;
  role: "admin" | "cliente" | "invitado";
} | null> => {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .maybeSingle();

  return {
    userId,
    email: profile?.email ?? (data.claims.email as string | undefined) ?? "",
    role: (profile?.role as "admin" | "cliente" | "invitado") ?? "cliente",
  };
});
