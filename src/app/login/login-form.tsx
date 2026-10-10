"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type LoginState } from "./actions";

/**
 * Formulario de login: correo, contraseña, entrar. Nada más.
 *
 * El prototipo de diseño traía cuatro controles que nunca se cablearon, y
 * todos se fueron porque prometían algo que el sistema no hace:
 *
 *  - Selector "Dueño de negocio / Administrador": no se enviaba al servidor
 *    (sin `name` ni campo oculto) y `signIn` no lo leía. El rol sale de
 *    `profiles.role` tras autenticar, y con él la redirección a `/backoffice`
 *    o `/portal` — ver `actions.ts`.
 *  - "Continuar con Google": deshabilitado con `title="Próximamente"`. No hay
 *    proveedor OAuth configurado en Supabase Auth.
 *  - "¿Olvidaste tu contraseña?": era un `<span>` sin destino. El reseteo de
 *    contraseña todavía no está implementado (llega con T-41); hoy solo se
 *    puede cambiar desde el dashboard de Supabase.
 *  - "¿No tenés cuenta? Creá tu negocio": tampoco llevaba a ningún lado, y
 *    contradecía el modelo — no hay registro público, las cuentas las crea el
 *    admin (`crearUsuario` en `backoffice/actions.ts`).
 *
 * Cuando alguna de esas funciones exista, el control vuelve con su destino
 * real. Mientras tanto, un botón muerto en la primera pantalla del producto
 * es peor que su ausencia: el usuario lo intenta y no pasa nada.
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
    </form>
  );
}
