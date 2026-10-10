/**
 * Definir contraseña (T-41): adonde llega la dueña desde el correo de
 * invitación, y cualquiera desde "olvidé mi contraseña".
 */

import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { ActionForm } from "@/components/action-form";
import { definirContrasena } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Definí tu contraseña — Nexo" };

const inputCls = "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export default async function DefinirContrasenaPage() {
  const me = await getUserRole();
  if (!me) redirect("/login?error=link");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-[364px] fade-up">
        <Logo />
        <h1 className="mt-8 text-[25px] font-extrabold text-ink">Definí tu contraseña</h1>
        <p className="mt-1 text-sm text-ink-mid">
          Es la que vas a usar para entrar a Nexo con {me.email}.
        </p>
        <ActionForm action={definirContrasena} submitLabel="Guardar y entrar" className="mt-6 space-y-4">
          <div>
            <label htmlFor="contrasena" className={labelCls}>Contraseña nueva</label>
            <input id="contrasena" name="contrasena" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
          </div>
          <div>
            <label htmlFor="repetida" className={labelCls}>Repetila</label>
            <input id="repetida" name="repetida" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
