/**
 * Logo "Nexo": tile azul con glifo de burbuja de chat + wordmark.
 * (Placeholder de marca según el handoff; sustituir por la marca real.)
 */

import { MessageCircle } from "lucide-react";

export function Logo({
  variant = "light",
  caption,
}: {
  /** light = texto oscuro (portal); dark = texto blanco (login/back office). */
  variant?: "light" | "dark";
  /** Línea pequeña bajo el nombre (p. ej. "BACK OFFICE"). */
  caption?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-white">
        <MessageCircle className="h-4 w-4" fill="currentColor" strokeWidth={0} />
      </span>
      <span className="leading-tight">
        <span
          className={`block text-[17px] font-extrabold ${
            variant === "dark" ? "text-white" : "text-ink"
          }`}
        >
          Nexo
        </span>
        {caption && (
          <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            {caption}
          </span>
        )}
      </span>
    </span>
  );
}
