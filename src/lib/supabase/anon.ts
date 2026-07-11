/**
 * Cliente Supabase anónimo (sin cookies ni sesión).
 *
 * Para las páginas públicas de /demo: RLS solo le permite leer las filas
 * marcadas `es_demo = true` (rubros y negocios de demostración).
 * Devuelve `null` si Supabase no está configurado.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
