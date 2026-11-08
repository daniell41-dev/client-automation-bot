"use server";

import { redirect } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import type { ActionState } from "@/components/action-form";
import { validarNuevaContrasena } from "./validar";

/**
 * Define la contraseña de la sesión actual. La sesión viene del link del
 * correo (invitación o recuperación, ver `/auth/confirm`): sin ella no hay a
 * quién cambiarle la contraseña.
 */
export async function definirContrasena(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: "El link venció o ya se usó. Pedí uno nuevo desde el login." };

  const contrasena = String(formData.get("contrasena") ?? "");
  const error = validarNuevaContrasena(contrasena, String(formData.get("repetida") ?? ""));
  if (error) return { error };

  const supabase = await createUserClient();
  const { error: updateError } = await supabase.auth.updateUser({ password: contrasena });
  if (updateError) return { error: `No se pudo guardar la contraseña: ${updateError.message}` };

  redirect(me.role === "admin" ? "/backoffice" : "/portal");
}
