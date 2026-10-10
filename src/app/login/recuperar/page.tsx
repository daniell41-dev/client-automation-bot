/** "Olvidé mi contraseña" (T-41). */

import Link from "next/link";
import { Logo } from "@/components/logo";
import { ActionForm } from "@/components/action-form";
import { pedirRecuperacion } from "./actions";

export const metadata = { title: "Recuperar contraseña — Nexo" };

export default function RecuperarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-[364px] fade-up">
        <Logo />
        <h1 className="mt-8 text-[25px] font-extrabold text-ink">¿Olvidaste tu contraseña?</h1>
        <p className="mt-1 text-sm text-ink-mid">Te mandamos un link a tu correo para definir una nueva.</p>
        <ActionForm action={pedirRecuperacion} submitLabel="Enviar link" className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">Correo electrónico</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@correo.com" className="input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft" />
          </div>
        </ActionForm>
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
          ← Volver al login
        </Link>
      </div>
    </main>
  );
}
