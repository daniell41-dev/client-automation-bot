/** "Olvidé mi contraseña" (T-41). */

import Link from "next/link";
import { Logo } from "@/components/logo";
import { ActionForm } from "@/components/action-form";
import { pedirRecuperacion } from "./actions";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (login.recuperar). */
const tt = textos.login.recuperar;

export const metadata = { title: textos.titulosPestana.recuperarContrasena };

export default function RecuperarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-[364px] fade-up">
        <Link href="/" aria-label={tt.irAlInicioDe} className="inline-block">
          <Logo />
        </Link>
        <h1 className="mt-8 text-[25px] font-extrabold text-ink">{tt.olvidoSuContrasena}</h1>
        <p className="mt-1 text-sm text-ink-mid">{tt.leEnviamosUnLink}</p>
        <ActionForm action={pedirRecuperacion} submitLabel={tt.enviarLink} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">{tt.correoElectronico}</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder={tt.nombreCorreoCom} className="input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft" />
          </div>
        </ActionForm>
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">{tt.volverAlLogin}</Link>
      </div>
    </main>
  );
}
