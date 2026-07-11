/**
 * Cliente Supabase para Server Components y Server Actions.
 *
 * Usa las cookies de Next para el contexto del usuario autenticado: todas las
 * queries hechas con este cliente pasan por RLS con la identidad del usuario.
 * Es la vía por defecto del portal y el back office (defensa en profundidad:
 * aunque una action tenga un bug, RLS limita lo que puede tocar).
 */

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

/** Rol del usuario autenticado, o `null` si no hay sesión. */
export async function getUserRole(): Promise<{
  userId: string;
  email: string;
  role: "admin" | "cliente" | "invitado";
} | null> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    role: (profile?.role as "admin" | "cliente" | "invitado") ?? "cliente",
  };
}
