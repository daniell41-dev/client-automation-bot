"use client";

/**
 * Editor de Citas y reservas: servicios reservables (toggle), horarios por
 * día (rango + toggle) y próximas reservas; preview del flujo de reserva.
 */

import { useActionState, useState } from "react";
import { CalendarDays, Plus, X } from "lucide-react";
import type { DiaAtencion, PedidosConfig, Service } from "@/core/types";
import { guardarConfigParcial, type ActionState } from "@/app/portal/actions";
import { Card, EmptyState, Pill, Toggle } from "@/components/ui";
import { PhonePreview } from "@/components/phone-preview";
import { MAX_TRAMOS_POR_DIA, NOMBRES_DIA } from "./horarios-form";

export interface ProximaReserva {
  id: string;
  nombre: string;
  servicio: string;
  fecha: string;
}

const timeCls =
  "input-nexo w-[74px] px-2 py-1 text-center text-[13px] text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export function CitasEditor({
  slug,
  initialServices,
  initialHorarios,
  initialPedidos,
  reservas,
  botName,
  botActivo,
}: {
  slug: string;
  initialServices: Service[];
  /** Exactamente 7 filas (una por día) — armadas por `buildSieteFilas` en `page.tsx`. */
  initialHorarios: DiaAtencion[];
  initialPedidos: PedidosConfig;
  reservas: ProximaReserva[];
  botName: string;
  botActivo: boolean;
}) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [horarios, setHorarios] = useState<DiaAtencion[]>(initialHorarios);
  const [pedidos, setPedidos] = useState<PedidosConfig>(initialPedidos);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    guardarConfigParcial,
    {},
  );

  const patchOpcion = (i: number, value: string) =>
    setPedidos((prev) => ({
      ...prev,
      opciones: prev.opciones.map((o, j) => (j === i ? value : o)),
    }));

  const toggleReservable = (id: string, next: boolean) =>
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, reservable: next } : s)),
    );

  const patchTramo = (diaIdx: number, tramoIdx: number, patch: Partial<{ desde: string; hasta: string }>) =>
    setHorarios((prev) =>
      prev.map((d, j) =>
        j === diaIdx
          ? { ...d, tramos: d.tramos.map((t, k) => (k === tramoIdx ? { ...t, ...patch } : t)) }
          : d,
      ),
    );

  const agregarTramo = (diaIdx: number) =>
    setHorarios((prev) =>
      prev.map((d, j) =>
        j === diaIdx && d.tramos.length < MAX_TRAMOS_POR_DIA
          ? { ...d, tramos: [...d.tramos, { desde: "09:00", hasta: "18:00" }] }
          : d,
      ),
    );

  const quitarTramo = (diaIdx: number, tramoIdx: number) =>
    setHorarios((prev) =>
      prev.map((d, j) =>
        j === diaIdx ? { ...d, tramos: d.tramos.filter((_, k) => k !== tramoIdx) } : d,
      ),
    );

  const toggleAbierto = (diaIdx: number, next: boolean) =>
    setHorarios((prev) =>
      prev.map((d, j) =>
        j === diaIdx
          ? {
              ...d,
              abierto: next,
              // Al abrir un día sin tramos cargados, arranca con uno por defecto.
              tramos: next && d.tramos.length === 0 ? [{ desde: "09:00", hasta: "18:00" }] : d.tramos,
            }
          : d,
      ),
    );

  const reservables = services.filter((s) => s.reservable);

  return (
    <div className="flex flex-wrap items-start gap-5 fade-up">
      {/* ── Columna de trabajo ── */}
      <div className="min-w-[300px] flex-[1_1_460px] space-y-4 sm:min-w-[420px]">
        {/* Servicios reservables */}
        <Card
          title="Servicios reservables"
          subtitle="El bot solo ofrece turnos para lo que esté activo."
        >
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-line p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-tint text-primary">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-bold text-ink">
                    {s.name}
                  </span>
                  <span className="block text-[13px] text-ink-soft">
                    {s.durationMinutes} min{s.categoria ? ` · ${s.categoria}` : ""}
                  </span>
                </span>
                <Toggle
                  checked={Boolean(s.reservable)}
                  onChange={(next) => toggleReservable(s.id, next)}
                  label={`Reservable: ${s.name}`}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Modalidad de pedido */}
        <Card
          title="Modalidad de pedido"
          subtitle="Para negocios donde el cliente puede retirar o consumir en el local (p. ej. restaurantes)."
          action={
            <Toggle
              checked={pedidos.enabled}
              onChange={(next) => setPedidos((prev) => ({ ...prev, enabled: next }))}
              label="Preguntar modalidad de entrega"
            />
          }
        >
          {pedidos.enabled && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Pregunta del bot</label>
                <input
                  className={inputCls}
                  value={pedidos.pregunta}
                  onChange={(e) =>
                    setPedidos((prev) => ({ ...prev, pregunta: e.target.value }))
                  }
                  placeholder="¿Vas a retirar tu pedido o prefieres comer en el local?"
                />
              </div>
              <div>
                <label className={labelCls}>Opciones (2 a 4)</label>
                <div className="space-y-2">
                  {pedidos.opciones.map((opcion, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        value={opcion}
                        onChange={(e) => patchOpcion(i, e.target.value)}
                        placeholder="Retirar en el local"
                      />
                      {pedidos.opciones.length > 2 && (
                        <button
                          type="button"
                          aria-label="Quitar opción"
                          onClick={() =>
                            setPedidos((prev) => ({
                              ...prev,
                              opciones: prev.opciones.filter((_, j) => j !== i),
                            }))
                          }
                          className="text-ink-soft hover:text-warn-ink"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pedidos.opciones.length < 4 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPedidos((prev) => ({
                        ...prev,
                        opciones: [...prev.opciones, ""],
                      }))
                    }
                    className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar opción
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Horarios de atención */}
        <Card
          title="Horarios de atención"
          subtitle="El bot no acepta citas fuera de estos horarios."
        >
          <div className="divide-y divide-line">
            {horarios.map((dia, i) => {
              const nombre = NOMBRES_DIA[dia.dow];
              return (
                <div key={dia.dow} className="flex flex-col gap-2 py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex-1 text-sm font-semibold ${
                        dia.abierto ? "text-ink" : "text-ink-soft"
                      }`}
                    >
                      {nombre}
                    </span>
                    {!dia.abierto && <span className="text-[13px] text-ink-soft">Cerrado</span>}
                    <Toggle
                      checked={dia.abierto}
                      onChange={(next) => toggleAbierto(i, next)}
                      label={`Abierto: ${nombre}`}
                    />
                  </div>
                  {dia.abierto && (
                    <div className="space-y-1.5 pl-1">
                      {dia.tramos.map((t, ti) => (
                        <div key={ti} className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1.5 text-[13px] text-ink-mid">
                            <input
                              className={timeCls}
                              value={t.desde}
                              onChange={(e) => patchTramo(i, ti, { desde: e.target.value })}
                            />
                            –
                            <input
                              className={timeCls}
                              value={t.hasta}
                              onChange={(e) => patchTramo(i, ti, { hasta: e.target.value })}
                            />
                          </span>
                          {dia.tramos.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Quitar tramo de ${nombre}`}
                              onClick={() => quitarTramo(i, ti)}
                              className="text-ink-soft hover:text-warn-ink"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {dia.tramos.length < MAX_TRAMOS_POR_DIA && (
                        <button
                          type="button"
                          onClick={() => agregarTramo(i)}
                          className="inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Agregar tramo (p. ej. corte de mediodía)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Próximas reservas */}
        <Card title="Próximas reservas">
          {reservas.length === 0 ? (
            <EmptyState
              title="Sin reservas por ahora."
              subtitle="Las citas que confirme el bot van a aparecer acá."
            />
          ) : (
            <ul className="divide-y divide-line">
              {reservas.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary">
                    {r.nombre.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-bold text-ink">
                      {r.nombre}
                    </span>
                    <span className="block truncate text-[13px] text-ink-soft">
                      {r.servicio} · {r.fecha}
                    </span>
                  </span>
                  <Pill tone="success">Confirmada</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Guardar */}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input
            type="hidden"
            name="patch"
            value={JSON.stringify({
              services,
              horarios,
              pedidos: {
                ...pedidos,
                pregunta: pedidos.pregunta.trim(),
                opciones: pedidos.opciones.map((o) => o.trim()).filter(Boolean),
              },
            })}
          />
          {state.error && (
            <p className="rounded-[10px] bg-warn-bg px-3 py-2 text-sm text-warn-ink">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p className="rounded-[10px] bg-success-bg px-3 py-2 text-sm text-success-ink">
              {state.ok}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[10px] bg-primary py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>

      {/* ── Preview: flujo de reserva (+ modalidad si está activa) ── */}
      <PhonePreview
        botName={botName}
        online={botActivo}
        messages={
          pedidos.enabled
            ? [
                { role: "in", text: "Hola, quiero hacer un pedido" },
                {
                  role: "out",
                  text: reservables.length
                    ? "¡Dale! ¿Cuál te gustaría?"
                    : "Contame qué se te antoja 😊",
                },
                { role: "in", text: reservables[0]?.name ?? "Bife de chorizo" },
                { role: "out", text: pedidos.pregunta || "¿Retirás o comés acá?" },
              ]
            : [
                { role: "in", text: "Hola, quiero reservar un turno" },
                {
                  role: "out",
                  text: reservables.length
                    ? "¡Claro! ¿Para cuál de estos servicios?"
                    : "Por ahora no tenemos turnos disponibles 🙏",
                },
              ]
        }
        quickReplies={
          pedidos.enabled
            ? pedidos.opciones.filter(Boolean)
            : reservables.length
              ? reservables.slice(0, 3).map((s) => s.name)
              : undefined
        }
      />
    </div>
  );
}
