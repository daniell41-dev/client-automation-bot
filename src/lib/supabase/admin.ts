/**
 * Cliente Supabase con SERVICE ROLE key (bypassa RLS).
 *
 * SOLO para código de servidor y scripts CLI: adaptadores del bot (el webhook
 * no tiene sesión de usuario), seed y administración de usuarios. No importar
 * desde componentes de cliente: la key no es NEXT_PUBLIC_, así que en un
 * bundle de navegador quedaría undefined y esto devolvería `null`.
 *
 * Devuelve `null` si faltan las env vars (degradación elegante: el factory
 * cae entonces a Google Sheets o JSON local).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function createAdminClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached =
    url && serviceKey
      ? createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return cached;
}
