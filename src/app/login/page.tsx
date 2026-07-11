/**
 * Página de login (email/contraseña).
 * El form usa una Server Action; el estado de error se muestra con useActionState.
 */

import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">
          Iniciar sesión
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Accede a tu portal para configurar tu bot.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
