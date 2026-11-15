"use client";

/**
 * T-87: el único JavaScript de cliente de la landing (autorizado en la tarea):
 * cambiar de pestaña. Patrón de pestañas de WAI-ARIA:
 * - role="tablist" / "tab" / "tabpanel", aria-selected y aria-controls;
 * - foco itinerante: solo la pestaña activa está en el orden de tabulación;
 * - flechas izquierda/derecha (con vuelta), Inicio y Fin mueven la pestaña.
 *
 * En celular las tres pestañas ocupan un tercio cada una (el texto puede ir
 * en dos líneas) para que ninguna quede escondida detrás de un scroll.
 *
 * Los paneles llegan ya armados desde el servidor y todos quedan en el HTML;
 * los inactivos solo llevan `hidden`. Así, sin JavaScript (o mientras carga),
 * la primera pestaña se ve completa y el texto de las otras sigue indexable.
 */

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface Pestana {
  id: string;
  etiqueta: string;
  /** Clase del color de acento (tokens de rubro), p. ej. "border-rubro-gastro-ink". */
  acento: string;
  panel: ReactNode;
}

/**
 * A qué pestaña lleva cada tecla desde la `actual` (con vuelta al llegar a los
 * extremos), o `null` si la tecla no mueve nada. Pura, para poder testearla.
 */
export function pestanaSegunTecla(tecla: string, actual: number, total: number): number | null {
  const destino: Record<string, number> = {
    ArrowRight: actual + 1,
    ArrowLeft: actual - 1,
    Home: 0,
    End: total - 1,
  };
  if (!(tecla in destino)) return null;
  return (destino[tecla] + total) % total;
}

export function NegociosPestanas({ pestanas }: { pestanas: Pestana[] }) {
  const [activa, setActiva] = useState(0);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino = pestanaSegunTecla(e.key, i, pestanas.length);
    if (destino === null) return;
    e.preventDefault();
    setActiva(destino);
    botones.current[destino]?.focus();
  };

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Tipos de negocio" className="grid grid-cols-3 border-b border-line-2 sm:flex sm:gap-1">
        {pestanas.map((p, i) => {
          const seleccionada = i === activa;
          return (
            <button
              key={p.id}
              ref={(el) => {
                botones.current[i] = el;
              }}
              id={`${base}-tab-${p.id}`}
              type="button"
              role="tab"
              aria-selected={seleccionada}
              aria-controls={`${base}-panel-${p.id}`}
              tabIndex={seleccionada ? 0 : -1}
              onClick={() => setActiva(i)}
              onKeyDown={(e) => alTeclear(e, i)}
              className={`-mb-px min-h-12 border-b-[3px] px-1.5 py-2 text-center text-[14px] font-bold leading-tight transition-colors sm:shrink-0 sm:whitespace-nowrap sm:text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-5 ${
                seleccionada ? `${p.acento} text-ink` : "border-transparent text-ink-mid hover:text-ink"
              }`}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>

      {pestanas.map((p, i) => (
        <div
          key={p.id}
          id={`${base}-panel-${p.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${p.id}`}
          hidden={i !== activa}
          tabIndex={0}
          className="pt-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          {p.panel}
        </div>
      ))}
    </div>
  );
}
