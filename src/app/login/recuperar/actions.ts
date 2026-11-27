"use server";

import { createUserClient } from "@/lib/supabase/server";
import { linkDefinirContrasena } from "@/lib/sitio";
import type { ActionState } from "@/components/action-form";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.recuperar). */
const tt = textos.acciones.recuperar;

/**
 * "Olvidé mi contraseña" (T-41). La respuesta es SIEMPRE la misma, exista o
 * no el correo: si dijera "ese correo no existe", el formulario serviría
 * para averiguar quién tiene cuenta en Aurela.
 */
export async function pedirRecuperacion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: tt.escribaSuCorreo };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await linkDefinirContrasena() });
  if (error) console.error("[Auth] resetPasswordForEmail falló:", error.message);

  return { ok: tt.siEseCorreoTiene };
}
