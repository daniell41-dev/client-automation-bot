"use client";

/**
 * T-90: aviso de medición y carga de Microsoft Clarity, solo si el visitante
 * acepta. Es el segundo JavaScript de cliente de la landing, autorizado en la
 * tarea; solo existe si hay `NEXT_PUBLIC_CLARITY_ID` (la página ni lo monta).
 *
 * - No bloquea: es una tarjeta pequeña abajo (a la izquierda en escritorio,
 *   para no tapar el aviso del teléfono del hero), sin fondo oscuro ni foco
 *   atrapado. Se puede seguir leyendo y tocando todo sin contestar.
 * - En el celular queda encima de la barra fija de WhatsApp, no sobre ella.
 * - El servidor no sabe qué decidió el visitante (está en su localStorage),
 *   así que en el HTML no sale nada y el aviso aparece al hidratar. Como es
 *   `fixed`, no empuja contenido (sin CLS).
 * - Clarity solo graba mientras esta página está montada: al navegar a otra
 *   ruta dentro de la app se pausa (ver el efecto).
 * - Los clics en los botones de WhatsApp se escuchan con un solo listener en
 *   el documento (por `data-origen`), para que `BotonWhatsApp` siga siendo de
 *   servidor.
 */

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { eventoWhatsApp, guardarDecision, leerDecision, urlScriptClarity, type Decision } from "@/lib/medicion";

type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global {
  interface Window {
    clarity?: Clarity;
  }
}

// Store mínimo sobre localStorage. La copia en memoria cubre el caso en que el
// navegador no deja guardar: la decisión se respeta igual durante la visita.
let enMemoria: Decision | null = null;
const oyentes = new Set<() => void>();

function almacen(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

const leer = (): Decision | null => enMemoria ?? leerDecision(almacen());
// En el servidor se responde "pendiente de leer", distinto de "sin decisión",
// para no pintar el aviso en el HTML y que desaparezca al hidratar.
const leerEnServidor = (): Decision | "servidor" | null => "servidor";

function decidir(decision: Decision) {
  enMemoria = decision;
  guardarDecision(almacen(), decision);
  oyentes.forEach((o) => o());
}

let cargado = false;
let pausado = false;

/** El snippet oficial de Clarity, sin `eval` ni script en línea: cola + <script async>. */
function cargarClarity(id: string) {
  if (cargado) return;
  cargado = true;
  const cola: Clarity =
    window.clarity ??
    function (...args: unknown[]) {
      (cola.q = cola.q ?? []).push(args);
    };
  window.clarity = cola;
  const script = document.createElement("script");
  script.async = true;
  script.src = urlScriptClarity(id);
  document.head.appendChild(script);
  // Se cargó porque el visitante aceptó: se lo decimos a Clarity.
  window.clarity("consent");
}

export function AvisoMedicion({ clarityId }: { clarityId: string }) {
  const decision = useSyncExternalStore(suscribir, leer, leerEnServidor);

  useEffect(() => {
    if (decision !== "aceptado") return;
    if (cargado && pausado) window.clarity?.("start");
    pausado = false;
    cargarClarity(clarityId);

    const alClic = (e: MouseEvent) => {
      const boton = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-origen]") : null;
      const origen = boton?.dataset.origen;
      if (origen) window.clarity?.("event", eventoWhatsApp(origen));
    };
    document.addEventListener("click", alClic);
    return () => {
      document.removeEventListener("click", alClic);
      // Al salir de la landing con un enlace interno (a /demo, /privacidad…)
      // Next no recarga la página y el script seguiría grabando allí. Se
      // pausa al desmontar y se reanuda si el visitante vuelve a "/".
      window.clarity?.("stop");
      pausado = true;
    };
  }, [decision, clarityId]);

  if (decision !== null) return null;

  return (
    <section
      aria-label="Aviso de medición"
      className="fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-line bg-surface p-4 shadow-lift sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm"
    >
      <p className="text-[14px] leading-snug text-ink">
        Usamos una herramienta para ver cómo se usa esta página y mejorarla.{" "}
        <Link href="/privacidad#medicion" className="font-semibold text-primary underline underline-offset-2">
          Política de privacidad
        </Link>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => decidir("aceptado")}
          className="min-h-12 rounded-[10px] bg-primary px-3 text-[14px] font-bold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Aceptar
        </button>
        <button
          type="button"
          onClick={() => decidir("rechazado")}
          className="min-h-12 rounded-[10px] border border-line-input px-3 text-[14px] font-bold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          No, gracias
        </button>
      </div>
    </section>
  );
}
