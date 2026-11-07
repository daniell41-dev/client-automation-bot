"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
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
 *  - "¿Olvidaste tu contraseña?": era un `<span>` sin destino. Volvió en
 *    T-41, ahora con destino real (`/login/recuperar`).
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
  // T-41: el link de un correo (invitación o recuperación) que venció o ya
  // se usó vuelve acá con ?error=link.
  const linkVencido = searchParams.get("error") === "link";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    {},
  );
  // T-68: ver la contraseña. En el celular, con teclado chico, es la causa
  // número uno de "credenciales incorrectas" sin saber por qué.
  const [verClave, setVerClave] = useState(false);

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
        <div className="relative">
          <input
            id="password"
            name="password"
            type={verClave ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="input-nexo w-full py-2.5 pl-3.5 pr-11 text-sm text-ink placeholder:text-ink-soft"
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-soft transition-colors hover:text-ink"
          >
            {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {linkVencido && !state.error && (
        <p className="rounded-[10px] bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          El link venció o ya se usó. Pedí uno nuevo con &quot;¿Olvidaste tu contraseña?&quot;.
        </p>
      )}

      {state.error && (
        <p className="rounded-[10px] bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(42,111,219,.7)] transition-all hover:-translate-y-px hover:bg-primary-hover disabled:translate-y-0 disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Ingresar"}
      </button>

      <Link href="/login/recuperar" className="block text-center text-sm font-semibold text-primary hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
