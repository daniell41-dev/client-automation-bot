"use server";

/**
 * Actions de autenticación (email/contraseña con Supabase Auth).
 * No hay registro público: los usuarios los crea el admin en el back office.
 */

import { redirect } from "next/navigation";
import { createUserClient, getUserRole } from "@/lib/supabase/server";

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
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Credenciales incorrectas. Verifica e intenta de nuevo." };
  }

  // Redirige según destino solicitado o rol.
  if (next.startsWith("/")) redirect(next);
  const me = await getUserRole();
  redirect(me?.role === "admin" ? "/backoffice" : "/portal");
}

export async function signOut(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}
