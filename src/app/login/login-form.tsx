"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type LoginState } from "./actions";

/**
 * Formulario de login.
 *
 * NO lleva selector de "Dueño de negocio / Administrador". El prototipo de
 * diseño traía uno, pero era puro adorno: nunca se enviaba al servidor (sin
 * `name` ni campo oculto) y `signIn` no lo leía. El rol sale de
 * `profiles.role` después de autenticar, y con él la redirección a
 * `/backoffice` o `/portal` — ver `actions.ts`.
 *
 * Mostrarlo era peor que no tenerlo: le hacía creer al usuario que elegía con
 * qué permisos entra, cuando su cuenta ya lo decide. Un admin que marcara
 * "Dueño de negocio" entraba igual al back office, y el control no tenía forma
 * de explicar por qué.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          className="input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft"
        />
        <p className="mt-2 text-right">
          <span className="cursor-default text-[13px] font-semibold text-primary">
            ¿Olvidaste tu contraseña?
          </span>
        </p>
      </div>

      {state.error && (
        <p className="rounded-[10px] bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[10px] bg-primary py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Ingresar"}
      </button>

      <div className="flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        o
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        disabled
        title="Próximamente"
        className="w-full rounded-[10px] border border-line-input py-2.5 text-sm font-semibold text-ink-mid opacity-60"
      >
        <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-tint text-[10px] font-bold text-primary">
          G
        </span>
        Continuar con Google
      </button>

      <p className="pt-2 text-center text-[13px] text-ink-mid">
        ¿No tenés cuenta?{" "}
        <span className="font-semibold text-primary">Creá tu negocio</span>
      </p>
    </form>
  );
}
