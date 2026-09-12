"use client";

/**
 * Botón "Eliminar"/"Quitar" con confirmación explícita (T-13): abre un
 * `<dialog>` nativo (overlay, foco atrapado y Escape-para-cerrar gratis, sin
 * dependencias) y solo dispara la Server Action al confirmar ahí adentro —
 * nunca al hacer click en el trigger. Muestra un toast de error si la action
 * falla, y uno de éxito si no navega a otra página tras confirmar (si
 * navega, como al eliminar un negocio, el cambio de pantalla ya es la señal
 * de éxito).
 */

import { useActionState, useEffect, useRef } from "react";
import { useToast } from "@/components/toast";

interface ActionState {
  error?: string;
  ok?: string;
}

type DeleteAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ConfirmDeleteButton({
  action,
  hiddenFields,
  title,
  description,
  blockedReason,
  triggerLabel = "Eliminar",
  triggerClassName = "text-sm font-semibold text-warn-ink hover:underline",
  confirmLabel = "Sí, eliminar",
  successMessage,
}: {
  action: DeleteAction;
  /** Se mandan como inputs hidden dentro del form del diálogo (p. ej. `{ id }`). */
  hiddenFields: Record<string, string>;
  title: string;
  description?: string;
  /**
   * Si viene, el diálogo NO deja confirmar: en vez del botón de confirmar
   * muestra este motivo (p. ej. "Tiene 2 negocios asociados"). Chequeo
   * proactivo en el cliente — la action igual revalida del lado del
   * servidor por si la situación cambió entre que se abrió el diálogo y se
   * confirma.
   */
  blockedReason?: string;
  triggerLabel?: string;
  triggerClassName?: string;
  confirmLabel?: string;
  /** Toast a mostrar si la action termina bien y NO navega a otra pantalla. */
  successMessage?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { notify } = useToast();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const wasPending = useRef(false);

  // Reacciona recién cuando una confirmación real TERMINA (pending true→false),
  // nunca en el montaje inicial (ahí pending nace en false).
  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state.error) {
        notify("error", state.error);
      } else {
        dialogRef.current?.close();
        notify("success", state.ok ?? successMessage ?? "Listo.");
      }
    }
    wasPending.current = pending;
  }, [pending, state, notify, successMessage]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        className="w-[min(90vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-card backdrop:bg-ink/40"
      >
        <form action={formAction}>
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          {description && <p className="mt-2 text-sm text-ink-mid">{description}</p>}
          {blockedReason && (
            <p className="mt-2 rounded-[10px] bg-warn-bg px-3 py-2 text-sm text-warn-ink">
              {blockedReason}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-[10px] border border-line px-4 py-2 text-sm font-bold text-ink hover:bg-surface-2"
            >
              {blockedReason ? "Cerrar" : "Cancelar"}
            </button>
            {!blockedReason && (
              <button
                type="submit"
                disabled={pending}
                className="rounded-[10px] bg-warn-ink px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Eliminando…" : confirmLabel}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
