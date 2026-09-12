"use client";

/**
 * Form genérico sobre una Server Action con estado {error, ok}.
 * Los campos se definen en el Server Component padre y llegan como children.
 */

import { useActionState } from "react";

export interface ActionState {
  error?: string;
  ok?: string;
}

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  submitLabel = "Guardar",
  className,
  onSubmit,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  /**
   * Validación previa en el cliente (T-12): si llama a `preventDefault()`,
   * la Server Action no se dispara — React respeta ese `preventDefault` del
   * evento `onSubmit` nativo aunque el `<form>` tenga `action={formAction}`.
   */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate={!!onSubmit}
      className={className ?? "space-y-3"}
    >
      {children}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.ok}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
