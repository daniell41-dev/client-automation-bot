/**
 * Login "Nexo": dos columnas a pantalla completa.
 * Izquierda: panel oscuro con glow, titular y mini-chat de muestra.
 * Derecha: formulario (el selector de rol es visual; la redirección real
 * sale de `profiles.role` tras autenticar — ver login-form).
 */

import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión — Nexo" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Panel izquierdo (oculto en móvil) */}
      <section
        className="relative hidden flex-[1.05] flex-col justify-between overflow-hidden p-10 lg:flex"
        style={{
          background:
            "radial-gradient(80% 60% at 20% 10%, rgba(42,111,219,.35) 0%, rgba(14,32,51,0) 60%), #0E2033",
        }}
      >
        <Logo variant="dark" />

        <div className="max-w-md">
          <h1 className="text-[42px] font-extrabold leading-[1.1] text-white">
            Tu negocio, respondiendo en WhatsApp las 24 horas.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Gestioná el catálogo, los turnos y las respuestas de tu bot desde un
            solo lugar. Sin escribir una línea de código.
          </p>
        </div>

        {/* Mini-chat de muestra */}
        <div className="max-w-sm space-y-2.5">
          <div className="w-fit rounded-xl rounded-bl-[4px] bg-white/10 px-4 py-2.5 text-sm text-white/90 backdrop-blur">
            ¿Hacen envíos a domicilio?
          </div>
          <div className="ml-8 w-fit rounded-xl rounded-br-[4px] bg-primary px-4 py-2.5 text-sm font-medium text-white">
            ¡Sí! Enviamos a toda la ciudad en el día.
          </div>
        </div>
      </section>

      {/* Formulario derecho */}
      <section className="flex w-full flex-col items-center justify-center bg-white px-6 py-10 lg:w-[520px] lg:max-w-[46%]">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-[364px] fade-up">
          <h2 className="text-[25px] font-extrabold text-ink">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-ink-mid">
            Ingresá para gestionar tus negocios.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
