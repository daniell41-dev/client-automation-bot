/**
 * Login "Nexo": dos columnas a pantalla completa.
 * Izquierda: el panel de marca (`hero.tsx`) — qué hace Nexo, mostrado.
 * Derecha: formulario. No se elige rol al entrar: sale de `profiles.role`
 * tras autenticar, y con él la redirección — ver `actions.ts`.
 */

import { Suspense } from "react";
import { Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";
import { LoginHero } from "./hero";

export const metadata = { title: "Iniciar sesión" };

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
        <div className="relative bg-[#0E2033] px-6 pb-8 pt-8 lg:hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(70% 90% at 10% 0%, rgba(42,111,219,.5) 0%, rgba(14,32,51,0) 70%)",
            }}
          />
          <div className="relative">
            <Logo variant="dark" />
            <p className="mt-4 font-display text-2xl font-extrabold leading-tight text-white">
              Tu negocio vende por WhatsApp las 24 horas.
            </p>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-[364px] fade-up">
            <h2 className="font-display text-[28px] font-extrabold text-ink">Hola de nuevo 👋</h2>
            <p className="mt-1 text-sm text-ink-mid">Ingresá para ver tus pedidos y gestionar tu negocio.</p>
            <Suspense>
              <LoginForm />
            </Suspense>
            <p className="mt-8 text-center text-xs leading-relaxed text-ink-soft">
              <Lock className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
              Conexión segura. Tus datos y los de tus clientes están protegidos.
            </p>
          </div>
        </div>

        <p className="relative pb-6 text-center text-xs text-ink-faint">© {new Date().getFullYear()} Nexo · Cúcuta, Colombia</p>
      </section>
    </main>
  );
}
