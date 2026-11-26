/**
 * Login "Aurela": dos columnas a pantalla completa.
 * Izquierda: el panel de marca (`hero.tsx`) — qué hace Aurela, mostrado.
 * Derecha: formulario. No se elige rol al entrar: sale de `profiles.role`
 * tras autenticar, y con él la redirección — ver `actions.ts`.
 */

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";
import { LoginHero } from "./hero";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (login.pagina). */
const tt = textos.login.pagina;

export const metadata = { title: textos.titulosPestana.iniciarSesion };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      <LoginHero />

      {/* Formulario derecho */}
      <section className="relative flex w-full flex-col overflow-hidden bg-white lg:w-[520px] lg:max-w-[46%]">
        {/* Una luz suave detrás del formulario: el lado blanco ya no es un
            plano vacío, sin distraer de los campos. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary-tint blur-3xl"
        />

        {/* En el celular no hay panel de marca: una franja con el logo y la frase. */}
        <div className="relative bg-[#2A0F2E] px-6 pb-8 pt-8 lg:hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(70% 90% at 10% 0%, rgba(107,36,117,.5) 0%, rgba(42,15,46,0) 70%)",
            }}
          />
          <div className="relative">
            <Link href="/" aria-label={tt.irAlInicioDe} className="inline-block">
              <Logo variant="dark" />
            </Link>
            <p className="mt-4 font-display text-2xl font-extrabold leading-tight text-white">{tt.suNegocioVendePor}</p>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-[364px] fade-up">
            {/* Quien llega desde la página de venta tiene que poder volver sin el
                botón "atrás" del navegador. Alto de 48 px para el dedo. */}
            <Link
              href="/"
              className="-ml-1 mb-4 inline-flex min-h-12 items-center gap-1.5 px-1 text-sm font-semibold text-ink-mid hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />{tt.volverAlInicio}</Link>
            <h2 className="font-display text-[28px] font-extrabold text-ink">{tt.holaDeNuevo}</h2>
            <p className="mt-1 text-sm text-ink-mid">{tt.ingreseParaVerSus}</p>
            <Suspense>
              <LoginForm />
            </Suspense>
            <p className="mt-8 text-center text-xs leading-relaxed text-ink-soft">
              <Lock className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />{tt.conexionSeguraSusDatos}</p>
          </div>
        </div>

        <p className="relative pb-6 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()}{tt.aurelaCucutaColombia}{" "}
          <Link href="/privacidad" className="hover:text-ink-mid">{tt.privacidad}</Link> ·{" "}
          <Link href="/terminos" className="hover:text-ink-mid">{tt.terminos}</Link>
        </p>
      </section>
    </main>
  );
}
