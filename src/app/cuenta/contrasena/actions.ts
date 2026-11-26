"use server";

import { redirect } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import type { ActionState } from "@/components/action-form";
import { validarNuevaContrasena } from "./validar";
import { formato, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.contrasena). */
const tt = textos.acciones.contrasena;

/**
 * Define la contraseña de la sesión actual. La sesión viene del link del
 * correo (invitación o recuperación, ver `/auth/confirm`): sin ella no hay a
 * quién cambiarle la contraseña.
 */
export async function definirContrasena(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.elLinkVencioO };

  const contrasena = String(formData.get("contrasena") ?? "");
  const error = validarNuevaContrasena(contrasena, String(formData.get("repetida") ?? ""));
  if (error) return { error };

  const supabase = await createUserClient();
  const { error: updateError } = await supabase.auth.updateUser({ password: contrasena });
  if (updateError) return { error: formato(tt.noSePudoGuardar, { message: updateError.message }) };

  redirect(me.role === "admin" ? "/backoffice" : "/portal");
}
