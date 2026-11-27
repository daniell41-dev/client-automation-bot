/**
 * "Le toca a usted": la lista de lo que espera a la dueña (pagos que no
 * cuadran, pedidos por aprobar, devoluciones). Va arriba de todo en el inicio
 * del portal y en el Resumen de un negocio, porque es lo único de la pantalla
 * que no se resuelve solo: lo demás Aurela ya lo atendió.
 */

import Link from "next/link";
import { AlertTriangle, Hand, ShoppingBag, Undo2, type LucideIcon } from "lucide-react";
import type { Pendiente, TipoPendiente } from "@/lib/inicio-portal";
import { formato, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (portal.leTocaAUsted). */
const tt = textos.portal.leTocaAUsted;

const ESTILO: Record<TipoPendiente, { icono: LucideIcon; tile: string; boton: string }> = {
  // T-155: alguien esperando que le escriba una persona: botón lleno, como lo urgente.
  persona: {
    icono: Hand,
    tile: "bg-primary-tint text-primary",
    boton: "bg-primary text-white hover:bg-primary-hover",
  },
  // Plata que puede faltar: el único con rojo y con botón lleno.
  no_cuadra: {
    icono: AlertTriangle,
    tile: "bg-red-50 text-red-700",
    boton: "bg-primary text-white hover:bg-primary-hover",
  },
  por_aprobar: {
    icono: ShoppingBag,
    tile: "bg-primary-tint text-primary",
    boton: "border border-line-input text-ink hover:bg-surface-3",
  },
  devolucion: {
    icono: Undo2,
    tile: "bg-warn-bg text-warn-ink",
    boton: "border border-line-input text-ink hover:bg-surface-3",
  },
};

export function LeTocaAUsted({ pendientes }: { pendientes: Pendiente[] }) {
  if (pendientes.length === 0) return null;
  return (
    <section
      aria-labelledby="le-toca"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="le-toca" className="text-[17px] font-extrabold text-ink">{tt.leTocaAUsted}</h2>
        <span className="rounded-full bg-gold-bg px-2.5 py-1 text-xs font-bold text-gold-ink">
          {pendientes.length === 1 ? tt.t1Pendiente : formato(tt.pendientes, { n: pendientes.length })}
        </span>
      </div>
      <ul>
        {pendientes.map((p, i) => {
          const { icono: Icono, tile, boton } = ESTILO[p.tipo];
          return (
            <li
              key={`${p.tipo}-${i}`}
              className="flex flex-wrap items-center gap-3.5 border-b border-line px-5 py-3.5 last:border-b-0"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                <Icono className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-[1_1_260px]">
                <p className="text-sm font-bold text-ink">{p.titulo}</p>
                <p className="mt-0.5 text-[13px] text-ink-mid">{p.detalle}</p>
              </div>
              <Link
                href={p.href}
                className={`inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-bold transition-colors ${boton}`}
              >
                {p.accion}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
