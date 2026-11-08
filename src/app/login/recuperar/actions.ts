"use server";

import { createUserClient } from "@/lib/supabase/server";
import { linkDefinirContrasena } from "@/lib/sitio";
import type { ActionState } from "@/components/action-form";

/**
 * "Olvidé mi contraseña" (T-41). La respuesta es SIEMPRE la misma, exista o
 * no el correo: si dijera "ese correo no existe", el formulario serviría
 * para averiguar quién tiene cuenta en Nexo.
 */
export async function pedirRecuperacion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribí tu correo." };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await linkDefinirContrasena() });
  if (error) console.error("[Auth] resetPasswordForEmail falló:", error.message);

  return { ok: "Si ese correo tiene cuenta en Nexo, te mandamos un link para definir una contraseña nueva." };
}
