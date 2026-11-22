"use client";

/**
 * Editor del catálogo: lista de ítems + card "Editar producto" + preview de
 * WhatsApp en vivo (cada cambio re-renderiza la tarjeta del teléfono).
 * A <1080px el teléfono se apila debajo del editor.
 */

import { useActionState, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { detallesDe, preguntaDetalles } from "@/core/engine/detalles";
import type { CatalogoConfig, Service } from "@/core/types";
import { servicesSchema } from "@/core/config-schema";
import { guardarConfigParcial, type ActionState } from "@/app/portal/actions";
import { Card, EmptyState, SearchInput, Toggle } from "@/components/ui";
import { PhonePreview } from "@/components/phone-preview";
import { catalogCopy, catalogItemLabel, rubroVisual } from "@/components/rubro-visual";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

/**
 * Un ítem nuevo arranca con duración solo si el rubro muestra ese campo
 * (T-21): en una tienda, un producto recién agregado no tiene por qué nacer
 * con "30 minutos" — nadie se lo va a sacar si no lo ve.
 */
/**
 * T-123: los detalles que se pueden agregar. Lista cerrada a propósito: con
 * texto libre cada dueña escribía "Talla", "tallas" o "Tallaje" y el bot
 * preguntaba distinto en cada producto.
 */
const TIPOS_DETALLE = ["Talla", "Color", "Estilo"];

/** "28, 30,30 , 32" → ["28", "30", "32"]: sin vacíos ni repetidas (sin importar mayúsculas). */
function separarOpciones(texto: string): string[] {
  const vistas = new Set<string>();
  return texto
    .split(",")
    .map((o) => o.trim())
    .filter((o) => {
      const clave = o.toLowerCase();
      if (!o || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
}

function nuevoItem(n: number, conDuracion: boolean): Service {
  return {
    id: `item-${Date.now()}-${n}`,
    name: "",
    description: "",
    price: 0,
    durationMinutes: conDuracion ? 30 : undefined,
    categoria: "",
    disponible: true,
  };
}

export function CatalogoEditor({
  slug,
  rubro,
  catalogo,
  initialServices,
  currency,
  locale,
  botName,
  botActivo,
}: {
  slug: string;
  rubro: string;
  /** T-21: forma del catálogo de este negocio — qué campos mostrar y cómo llamar a un ítem. */
  catalogo?: CatalogoConfig;
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
  // T-123: el mini formulario de "Agregar detalles" (qué detalle y sus
  // opciones) antes de tocar el +. Lo agregado vive en `Service.detalles`.
  const [borrador, setBorrador] = useState({ tipo: TIPOS_DETALLE[0], opciones: "" });
  const agregarDetalle = (service: Service) => {
    const opciones = separarOpciones(borrador.opciones);
    if (opciones.length === 0) return;
    const actuales = detallesDe(service);
    // El mismo detalle otra vez reemplaza sus opciones en vez de duplicarlo.
    const existe = actuales.some((d) => d.nombre === borrador.tipo);
    const detalles = existe
      ? actuales.map((d) => (d.nombre === borrador.tipo ? { nombre: d.nombre, opciones } : d))
      : [...actuales, { nombre: borrador.tipo, opciones }];
    // `variantes` (T-104) se pasa a `detalles` al primer cambio: un solo lugar.
    patchService(service.id, { detalles, variantes: undefined });
    const libre = TIPOS_DETALLE.find((t) => !detalles.some((d) => d.nombre === t));
    setBorrador({ tipo: libre ?? borrador.tipo, opciones: "" });
    if (fieldErrors.detalles) setFieldErrors((prev) => ({ ...prev, detalles: "" }));
  };
  const quitarDetalle = (service: Service, nombre: string) => {
    const detalles = detallesDe(service).filter((d) => d.nombre !== nombre);
    patchService(service.id, { detalles: detalles.length > 0 ? detalles : undefined, variantes: undefined });
  };
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

  // T-21: qué campos tiene sentido pedirle a ESTE rubro. `undefined` en
  // `catalogo.campos` = comportamiento previo a T-21 (mostrar Duración,
  // ocultar Stock) — así ningún rubro ya cargado pierde un campo que ya usaba.
  const mostrarDuracion = catalogo?.campos?.duracion !== false;
  const mostrarStock = catalogo?.campos?.stock === true;
  const itemLabel = catalogItemLabel(rubro, catalogo);

  const agregar = () => {
    const item = nuevoItem(services.length + 1, mostrarDuracion);
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

  // T-18: el icono de cada ítem usaba SIEMPRE los colores de "gastro"
  // (04-catalogo.png es justo un negocio gastro) — con `rubroVisual` sale
  // del rubro real, como ya hace `RubroTile` en el resto del portal.
  const { bg: iconBg, ink: iconInk } = rubroVisual(rubro);
  const { categoriaPlaceholder, previewSaludo, previewSustantivo, previewCta } =
    catalogCopy(rubro, catalogo);

  return (
    <div className="flex flex-wrap items-start gap-5 fade-up">
      {/* ── Columna de trabajo ── */}
      <div className="min-w-0 flex-[1_1_460px] space-y-4 sm:min-w-[420px]">
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
            title={search ? "Sin resultados." : "Su catálogo está vacío."}
            subtitle={search ? undefined : `Agregue su primer ${itemLabel.toLowerCase()}.`}
          />
        ) : (
          <div className="space-y-2">
            {visibles.map((s) => (
              // T-73: la fila era un <button> con el interruptor (otro <button>)
              // adentro: HTML inválido que rompía la hidratación y confundía a los
              // lectores de pantalla. Ahora el contenedor es un div y la parte
              // que selecciona es un botón hermano del interruptor.
              <div
                key={s.id}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 transition-colors ${
                  s.id === selectedId
                    ? "border-primary bg-primary-tint"
                    : "border-line bg-surface hover:bg-surface-3"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  aria-pressed={s.id === selectedId}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-sm font-extrabold ${iconBg} ${iconInk}`}
                >
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
                </button>
                <Toggle
                  checked={s.disponible !== false}
                  onChange={(next) => patchService(s.id, { disponible: next })}
                  label={`Disponibilidad de ${s.name}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Editar producto */}
        {selected && (
          <Card
            title={`Editar ${itemLabel.toLowerCase()}`}
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
                  placeholder={categoriaPlaceholder}
                />
              </div>
              {mostrarDuracion && (
                <div>
                  <label className={labelCls}>Duración (minutos)</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={1}
                    value={selected.durationMinutes ?? ""}
                    onChange={(e) =>
                      patchService(selected.id, {
                        durationMinutes:
                          e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </div>
              )}
              {mostrarStock && (
                <div>
                  <label className={labelCls}>Stock</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={selected.stock ?? ""}
                    onChange={(e) =>
                      patchService(selected.id, {
                        stock: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="Unidades disponibles"
                  />
                </div>
              )}
              {/* T-104: referencia del mayorista y opciones (tallas, colores…). Opcionales:
                  un restaurante los deja vacíos y todo funciona como antes. */}
              <div>
                <label className={labelCls}>Referencia (opcional)</label>
                <input
                  className={inputCls}
                  value={selected.referencia ?? ""}
                  onChange={(e) =>
                    patchService(selected.id, { referencia: e.target.value.trim() === "" ? undefined : e.target.value })
                  }
                  placeholder="Ej. 102"
                />
                <p className="mt-1 text-xs text-ink-mid">El código con el que sus clientes piden el producto.</p>
                {fieldErrors.referencia && (
                  <p className="mt-1 text-xs text-warn-ink">{fieldErrors.referencia}</p>
                )}
              </div>
              {/* T-123: "Agregar detalles". Un mini formulario (qué detalle, sus
                  opciones y el +) y abajo la lista de lo agregado. Reemplaza los
                  dos campos de T-104/T-107, que solo permitían una lista: un jean
                  viene en talla Y en color. */}
              <div className="sm:col-span-2 rounded-xl border border-line p-3">
                <p className="text-sm font-semibold text-ink">Detalles del producto (opcional)</p>
                <p className="mb-3 text-xs text-ink-mid">
                  Si el producto viene en varias tallas, colores o estilos, agréguelos aquí. El bot le pregunta al
                  cliente cuál quiere antes de cerrar el pedido.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="sm:w-40">
                    <label className={labelCls} htmlFor="detalle-tipo">Detalle</label>
                    <select
                      id="detalle-tipo"
                      className={inputCls}
                      value={borrador.tipo}
                      onChange={(e) => setBorrador((b) => ({ ...b, tipo: e.target.value }))}
                    >
                      {TIPOS_DETALLE.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className={labelCls} htmlFor="detalle-opciones">Opciones</label>
                    <input
                      id="detalle-opciones"
                      className={inputCls}
                      value={borrador.opciones}
                      onChange={(e) => setBorrador((b) => ({ ...b, opciones: e.target.value }))}
                      onKeyDown={(e) => {
                        // Enter agrega el detalle en vez de enviar todo el formulario.
                        if (e.key === "Enter") {
                          e.preventDefault();
                          agregarDetalle(selected);
                        }
                      }}
                      placeholder={borrador.tipo === "Talla" ? "28, 30, 32, 34" : borrador.tipo === "Color" ? "Blanco, Azul, Negro" : "Clásico, Skinny"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => agregarDetalle(selected)}
                    disabled={
                      separarOpciones(borrador.opciones).length === 0 ||
                      (detallesDe(selected).length >= 3 && !detallesDe(selected).some((d) => d.nombre === borrador.tipo))
                    }
                    aria-label="Agregar detalle"
                    title="Agregar detalle"
                    className="flex h-[42px] w-full shrink-0 items-center justify-center rounded-[10px] bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-40 sm:w-[42px]"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-ink-mid">
                  Opciones separadas por coma. Si agrega un detalle que ya está, se reemplazan sus opciones.
                </p>

                {detallesDe(selected).length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {detallesDe(selected).map((d) => (
                      <li
                        key={d.nombre}
                        className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{d.nombre}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {d.opciones.map((o) => (
                              <span key={o} className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-semibold text-primary">
                                {o}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => quitarDetalle(selected, d.nombre)}
                          aria-label={`Quitar ${d.nombre}`}
                          title={`Quitar ${d.nombre}`}
                          className="shrink-0 rounded-md p-1 text-ink-mid transition-colors hover:bg-warn-bg hover:text-warn-ink"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {detallesDe(selected).length > 0 && (
                  <p className="mt-3 rounded-lg bg-primary-tint px-3 py-2 text-xs text-ink">
                    El bot preguntará: «{preguntaDetalles(selected, selected.name || "producto")}»
                  </p>
                )}
                {(fieldErrors.detalles || fieldErrors.variantes) && (
                  <p className="mt-1 text-xs text-warn-ink">{fieldErrors.detalles || fieldErrors.variantes}</p>
                )}
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
          { role: "in", text: previewSaludo },
          {
            role: "out",
            text: selected?.name
              ? `¡Hola! Le comparto ${previewSustantivo}:`
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
                cta: previewCta,
              }
            : undefined
        }
        quickReplies={["Ver más opciones", "Hablar con alguien"]}
      />
    </div>
  );
}
