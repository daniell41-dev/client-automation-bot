/**
 * Cliente Supabase del navegador (T-38c), con la sesión de la dueña (cookies
 * de `@supabase/ssr`). Solo se usa para escuchar cambios en vivo: lo que se
 * lee o escribe sigue pasando por Server Components y Server Actions.
 * Devuelve `null` si Supabase no está configurado.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
