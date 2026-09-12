"use client";

/**
 * Editor del catálogo: lista de ítems + card "Editar producto" + preview de
 * WhatsApp en vivo (cada cambio re-renderiza la tarjeta del teléfono).
 * A <1080px el teléfono se apila debajo del editor.
 */

import { useActionState, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import type { Service } from "@/core/types";
import { servicesSchema } from "@/core/config-schema";
import { guardarConfigParcial, type ActionState } from "@/app/portal/actions";
import { Card, EmptyState, SearchInput, Toggle } from "@/components/ui";
import { PhonePreview } from "@/components/phone-preview";
import { catalogLabel } from "@/components/rubro-visual";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

function nuevoItem(n: number): Service {
  return {
    id: `item-${Date.now()}-${n}`,
    name: "",
    description: "",
    price: 0,
    durationMinutes: 30,
    categoria: "",
    disponible: true,
  };
}

export function CatalogoEditor({
  slug,
  rubro,
  initialServices,
  currency,
  locale,
  botName,
  botActivo,
}: {
  slug: string;
  rubro: string;
  initialServices: Service[];
  currency: string;
  locale: string;
  botName: string;
  botActivo: boolean;
}) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialServices[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    guardarConfigParcial,
    {},
  );

  const precio = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    [locale, currency],
  );

  const visibles = services.filter(
    (s) =>
      !search.trim() ||
      `${s.name} ${s.categoria ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = services.find((s) => s.id === selectedId) ?? null;

  const patchService = (id: string, patch: Partial<Service>) =>
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const agregar = () => {
    const item = nuevoItem(services.length + 1);
    setServices((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  /**
   * Valida el catálogo con el MISMO schema que usa `guardarConfigParcial` en
   * el servidor (T-12) antes de enviarlo — así el error aparece al toque, sin
   * ida y vuelta al servidor. Si algún ítem falla, lo selecciona para que el
   * error se vea en el campo real, no en un aviso genérico.
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const result = servicesSchema.safeParse(services);
    if (result.success) {
      setFieldErrors({});
      return;
    }
    e.preventDefault();
    const first = result.error.issues[0];
    const index = typeof first.path[0] === "number" ? first.path[0] : 0;
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      if (issue.path[0] === index && typeof issue.path[1] === "string") {
        errors[issue.path[1]] = issue.message;
      }
    }
    setSelectedId(services[index]?.id ?? null);
    setFieldErrors(errors);
  };

  const esMenu = catalogLabel(rubro) === "Menú";

  return (
    <div className="flex flex-wrap items-start gap-5 fade-up">
      {/* ── Columna de trabajo ── */}
      <div className="min-w-[300px] flex-[1_1_460px] space-y-4 sm:min-w-[420px]">
        {/* Toolbar */}
        <div className="flex gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar en el catálogo…"
            className="flex-1"
          />
          <button
            type="button"
            onClick={agregar}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </div>

        {/* Lista de ítems */}
        {visibles.length === 0 ? (
          <EmptyState
            title={search ? "Sin resultados." : "Tu catálogo está vacío."}
            subtitle={search ? undefined : "Agregá tu primer producto o servicio."}
          />
        ) : (
          <div className="space-y-2">
            {visibles.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  s.id === selectedId
                    ? "border-primary bg-primary-tint"
                    : "border-line bg-surface hover:bg-surface-3"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-rubro-gastro-bg text-sm font-extrabold text-rubro-gastro-ink">
                  {(s.name || "·").slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-bold text-ink">
                    {s.name || "(sin nombre)"}
                  </span>
                  <span className="block text-[13px] text-ink-soft">
                    {[s.categoria, precio.format(s.price)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Toggle
                  checked={s.disponible !== false}
                  onChange={(next) => patchService(s.id, { disponible: next })}
                  label={`Disponibilidad de ${s.name}`}
                />
              </button>
            ))}
          </div>
        )}

        {/* Editar producto */}
        {selected && (
          <Card
            title="Editar producto"
            action={
              <span className="flex items-center gap-2 text-sm text-ink-mid">
                Disponible
                <Toggle
                  checked={selected.disponible !== false}
                  onChange={(next) => patchService(selected.id, { disponible: next })}
                />
              </span>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nombre</label>
                <input
                  className={`${inputCls} ${fieldErrors.name ? "border-warn-ink" : ""}`}
                  value={selected.name}
                  onChange={(e) => {
                    patchService(selected.id, { name: e.target.value });
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                  }}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-warn-ink">{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Precio</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                    $
                  </span>
                  <input
                    className={`${inputCls} pl-7 ${fieldErrors.price ? "border-warn-ink" : ""}`}
                    type="number"
                    min={0}
                    value={selected.price}
                    onChange={(e) => {
                      patchService(selected.id, { price: Number(e.target.value) });
                      if (fieldErrors.price) setFieldErrors((prev) => ({ ...prev, price: "" }));
                    }}
                  />
                </div>
                {fieldErrors.price && (
                  <p className="mt-1 text-xs text-warn-ink">{fieldErrors.price}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Categoría</label>
                <input
                  className={inputCls}
                  value={selected.categoria ?? ""}
                  onChange={(e) =>
                    patchService(selected.id, { categoria: e.target.value })
                  }
                  placeholder={esMenu ? "Entradas" : "Faciales"}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Descripción</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={selected.description}
                  onChange={(e) =>
                    patchService(selected.id, { description: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setServices((prev) => prev.filter((s) => s.id !== selected.id));
                  setSelectedId(services.find((s) => s.id !== selected.id)?.id ?? null);
                }}
                className="text-sm font-semibold text-warn-ink hover:underline"
              >
                Quitar del catálogo
              </button>
              <p className="hidden text-xs text-ink-soft min-[1080px]:block">
                Los cambios se reflejan al instante en el chat del bot →
              </p>
            </div>
          </Card>
        )}

        {/* Guardar */}
        <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="patch" value={JSON.stringify({ services })} />
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

      {/* ── Preview ── */}
      <PhonePreview
        botName={botName}
        online={botActivo}
        messages={[
          { role: "in", text: esMenu ? "¡Hola! ¿Qué tienen hoy?" : "¡Hola! ¿Qué servicios ofrecen?" },
          {
            role: "out",
            text: selected?.name
              ? `¡Hola! Te comparto ${esMenu ? "nuestro plato" : "nuestro servicio"}:`
              : "¡Hola! Este es nuestro catálogo:",
          },
        ]}
        productCard={
          selected
            ? {
                categoria: selected.categoria,
                nombre: selected.name || "(sin nombre)",
                precio: precio.format(selected.price),
                descripcion: selected.description,
                cta: esMenu ? "Agregar al pedido" : "Reservar turno",
              }
            : undefined
        }
        quickReplies={["Ver más opciones", "Hablar con alguien"]}
      />
    </div>
  );
}
