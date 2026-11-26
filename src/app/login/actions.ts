"use server";

/**
 * Actions de autenticación (email/contraseña con Supabase Auth).
 * No hay registro público: los usuarios los crea el admin en el back office.
 */

import { redirect } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { destinoSeguro } from "@/app/login/destino";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.login). */
const tt = textos.acciones.login;

export interface LoginState {
  error?: string;
}

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: tt.ingreseSuCorreoY };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: tt.credencialesIncorrectasVerifiqueE };
  }

  // Redirige según destino solicitado o rol.
  const destino = destinoSeguro(next);
  if (destino) redirect(destino);
  const me = await getUserRole();
  redirect(me?.role === "admin" ? "/backoffice" : "/portal");
}

export async function signOut(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}
