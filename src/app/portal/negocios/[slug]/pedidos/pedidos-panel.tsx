"use client";

/**
 * Panel de pedidos (T-38): una columna por estado, pensado para usarse desde
 * el celular en un día de muchos pedidos. Cada acción es un formulario sobre
 * una Server Action — el panel no decide nada, solo muestra y envía.
 */

import { useActionState } from "react";
import type { ColumnaPanel } from "@/core/engine/panel-pedidos";
import { COLUMNAS_PANEL } from "@/core/engine/panel-pedidos";
import type { Pedido } from "@/core/storage/pedido-repository";
import type { ActionState } from "@/components/action-form";
import { Pill } from "@/components/ui";
import { decidirPedido, entregarPedido, marcarListo } from "./actions";

export type SeñalesPorPedido = Record<string, { detalle: string; nivel: string }[]>;

function formatPrecio(valor: number, moneda: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(valor);
}

function Resultado({ state }: { state: ActionState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn-ink">{state.error}</p>;
  if (state.ok) return <p className="mt-2 rounded-lg bg-success-bg px-3 py-2 text-xs text-success-ink">{state.ok}</p>;
  return null;
}

const botonPrimario =
  "rounded-[10px] bg-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50";
const botonSecundario =
  "rounded-[10px] border border-line px-3 py-2 text-sm font-semibold text-ink-mid transition-colors hover:bg-surface-3 disabled:opacity-50";

function AccionesVerificar({ slug, pedido }: { slug: string; pedido: Pedido }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(decidirPedido, {});
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="pedidoId" value={pedido.id} />
      <p className="mb-2 text-xs text-ink-soft">👀 Antes de aprobar, revisá en tu app del banco que la plata llegó.</p>
      <div className="flex gap-2">
        <button type="submit" name="decision" value="aprobar" disabled={pending} className={botonPrimario}>
          Aprobar #{pedido.numero}
        </button>
        <button type="submit" name="decision" value="rechazar" disabled={pending} className={botonSecundario}>
          Rechazar
        </button>
      </div>
      <Resultado state={state} />
    </form>
  );
}

function AccionListo({ slug, pedido }: { slug: string; pedido: Pedido }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(marcarListo, {});
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="pedidoId" value={pedido.id} />
      <button type="submit" disabled={pending} className={botonSecundario}>
        Marcar listo
      </button>
      <Resultado state={state} />
    </form>
  );
}

function AccionEntregar({ slug, pedido }: { slug: string; pedido: Pedido }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(entregarPedido, {});
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="pedidoId" value={pedido.id} />
      <label htmlFor={`codigo-${pedido.id}`} className="mb-1 block text-xs font-semibold text-ink-mid">
        Código que muestra el cliente
      </label>
      <div className="flex gap-2">
        <input
          id={`codigo-${pedido.id}`}
          name="codigo"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="4821"
          className="input-nexo w-24 px-3 py-2 text-sm tabular-nums"
        />
        <button type="submit" disabled={pending} className={botonPrimario}>
          Entregar
        </button>
      </div>
      <Resultado state={state} />
    </form>
  );
}

function TarjetaPedido({
  slug,
  pedido,
  columna,
  señales,
  foto,
  moneda,
  locale,
}: {
  slug: string;
  pedido: Pedido;
  columna: ColumnaPanel;
  señales: { detalle: string; nivel: string }[];
  foto?: string;
  moneda: string;
  locale: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-ink">#{pedido.numero}</p>
          <p className="truncate text-sm text-ink-mid">{pedido.cliente ?? pedido.contacto}</p>
        </div>
        <p className="text-base font-bold tabular-nums text-ink">{formatPrecio(pedido.total, moneda, locale)}</p>
      </header>

      <ul className="mt-2 space-y-0.5 text-sm text-ink">
        {pedido.items.map((item) => (
          <li key={item.serviceId}>
            {item.cantidad}x {item.nombre}
          </li>
        ))}
      </ul>

      {(pedido.modalidad || pedido.direccion) && (
        <p className="mt-2 text-xs text-ink-mid">
          {pedido.modalidad}
          {pedido.direccion ? ` · ${pedido.direccion}` : ""}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {pedido.estado === "esperando_pago" && <Pill tone="neutral">Sin comprobante</Pill>}
        {señales.map((s) => (
          <Pill key={s.detalle} tone={s.nivel === "alta" ? "warn" : "neutral"}>
            ⚠️ {s.detalle}
          </Pill>
        ))}
      </div>

      {foto && (
        <a
          href={foto}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          🧾 Ver foto del comprobante
        </a>
      )}

      {columna === "por_verificar" && <AccionesVerificar slug={slug} pedido={pedido} />}
      {columna === "en_preparacion" && (
        <>
          <AccionListo slug={slug} pedido={pedido} />
          <AccionEntregar slug={slug} pedido={pedido} />
        </>
      )}
      {columna === "listo" && <AccionEntregar slug={slug} pedido={pedido} />}
    </article>
  );
}

export function PedidosPanel({
  slug,
  panel,
  señales,
  fotos,
  moneda,
  locale,
}: {
  slug: string;
  panel: Record<ColumnaPanel, Pedido[]>;
  señales: SeñalesPorPedido;
  /** T-38b: URL firmada de la foto del comprobante, por id de pedido. */
  fotos: Record<string, string>;
  moneda: string;
  locale: string;
}) {
  return (
    <div className="fade-up">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-ink">Pedidos</h1>
        <p className="text-sm text-ink-mid">
          Aprobá, prepará y entregá. La comida se entrega solo contra el código de retiro del cliente.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS_PANEL.map((columna) => (
          <section key={columna.id} className="min-w-0">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-mid">
              {columna.titulo}
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums">{panel[columna.id].length}</span>
            </h2>
            <div className="space-y-3">
              {panel[columna.id].length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line p-4 text-center text-xs text-ink-soft">
                  Nada por acá.
                </p>
              ) : (
                panel[columna.id].map((pedido) => (
                  <TarjetaPedido
                    key={pedido.id}
                    slug={slug}
                    pedido={pedido}
                    columna={columna.id}
                    señales={señales[pedido.id] ?? []}
                    foto={fotos[pedido.id]}
                    moneda={moneda}
                    locale={locale}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
