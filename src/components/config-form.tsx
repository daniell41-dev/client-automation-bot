"use client";

/**
 * Formulario de edición de un `BusinessConfig`.
 *
 * Compartido por el back office (template del rubro) y el portal (config del
 * negocio del cliente). Mantiene el objeto en estado local y lo envía como
 * JSON en un campo oculto; la Server Action lo valida con Zod
 * (`parseBusinessConfig`) antes de escribir en la base.
 */

import { useActionState, useState } from "react";
import type { BusinessConfig, CatalogoConfig, Service } from "@/core/types";
import { esCita } from "@/core/engine/modo-item";

export interface ConfigActionState {
  error?: string;
  ok?: string;
}

type ConfigAction = (
  prev: ConfigActionState,
  formData: FormData,
) => Promise<ConfigActionState>;

const MESSAGE_LABELS: Record<keyof BusinessConfig["messages"], string> = {
  welcome: "Bienvenida (saludo + menú)",
  askName: "Pedir nombre",
  askDate: "Pedir fecha",
  askConfirm: "Pedir confirmación de la cita",
  serviceInfo: "Info de un servicio",
  captured: "Cita agendada (mensaje final)",
  fallback: "No entendí (fallback)",
  citaVigente: "Recordatorio de cita vigente (ya confirmó, escribe de nuevo)",
  askCantidad: "Pedir cuánto quiere de un producto",
  askConfirmPedido: "Pedir confirmación del pedido (cierre, después del detalle)",
  esperandoAprobacion: "Pedido en revisión (mientras la dueña acepta o rechaza)",
  pedidoConfirmado: "Pedido aceptado por la dueña (mensaje final)",
  pedidoRechazado: "Pedido rechazado por la dueña",
  pedidoVigente: "Recordatorio de pedido vigente (ya confirmó, escribe de nuevo)",
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";
const sectionCls = "rounded-xl border border-slate-200 bg-white p-5";

function emptyService(): Service {
  return { id: "", name: "", description: "", price: 0, durationMinutes: 30, keywords: [] };
}

export function ConfigForm({
  initial,
  action,
  fieldName = "config",
  hidden = {},
  submitLabel = "Guardar",
}: {
  initial: BusinessConfig;
  action: ConfigAction;
  /** Nombre del campo oculto con el JSON (ej. "template" o "config"). */
  fieldName?: string;
  /** Campos ocultos extra que necesita la action (ej. { id }). */
  hidden?: Record<string, string>;
  submitLabel?: string;
}) {
  const [config, setConfig] = useState<BusinessConfig>(initial);
  const [state, formAction, pending] = useActionState<ConfigActionState, FormData>(
    action,
    {},
  );

  const set = <K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const setService = (i: number, patch: Partial<Service>) =>
    set(
      "services",
      config.services.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );

  const setMessage = (key: keyof BusinessConfig["messages"], value: string) =>
    set("messages", { ...config.messages, [key]: value });

  // T-21: el bloque que declara qué persigue el bot de este rubro. Vive acá
  // (y no en una pantalla aparte) porque es el mismo lugar donde ya se arma
  // la plantilla completa — separarlo obligaría a guardar dos veces.
  const setCatalogo = (patch: Partial<CatalogoConfig>) =>
    set("catalogo", { ...config.catalogo, ...patch });
  const setCatalogoCampos = (patch: Partial<NonNullable<CatalogoConfig["campos"]>>) =>
    setCatalogo({ campos: { ...config.catalogo?.campos, ...patch } });

  // Sin ningún ítem que se agende, los mensajes de "cita" no tienen con qué
  // llenarse — mostrarlos igual sería pedirle al admin que redacte un texto
  // para un paso del funnel que nunca corre en este rubro.
  const hayItemDeCita = config.services.some((s) => esCita(s, config.catalogo));
  const hayItemDePedido = config.services.some((s) => !esCita(s, config.catalogo));
  const MENSAJES_SOLO_CITA = new Set<keyof BusinessConfig["messages"]>([
    "askDate",
    "askConfirm",
    "captured",
    "citaVigente",
  ]);
  const MENSAJES_SOLO_PEDIDO = new Set<keyof BusinessConfig["messages"]>([
    "askCantidad",
    "askConfirmPedido",
    "esperandoAprobacion",
    "pedidoConfirmado",
    "pedidoRechazado",
    "pedidoVigente",
  ]);

  const persona = config.personas?.whatsapp ?? { name: "", tone: "", language: "" };
  const setPersona = (patch: Partial<typeof persona>) => {
    const next = { ...persona, ...patch };
    const enabled = next.name.trim() !== "";
    set(
      "personas",
      enabled ? { ...config.personas, whatsapp: next } : undefined,
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name={fieldName} value={JSON.stringify(config)} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {/* Datos generales */}
      <section className={sectionCls}>
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Datos generales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nombre del negocio</label>
            <input
              className={inputCls}
              value={config.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Moneda</label>
            <input
              className={inputCls}
              value={config.currency}
              onChange={(e) => set("currency", e.target.value)}
              placeholder="COP"
            />
          </div>
          <div>
            <label className={labelCls}>Link de agenda (opcional)</label>
            <input
              className={inputCls}
              value={config.bookingUrl ?? ""}
              onChange={(e) => set("bookingUrl", e.target.value || undefined)}
              placeholder="https://calendly.com/…"
            />
          </div>
        </div>
      </section>

      {/* Catálogo de este rubro (T-21) */}
      <section className={sectionCls}>
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Catálogo de este rubro</h2>
        <p className="mb-4 text-xs text-slate-500">
          Qué persigue el bot con los ítems de este rubro. Sin tocar nada acá, se
          comporta como una cita (igual que antes de esto existir).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Cómo se llama UN ítem (singular)</label>
            <input
              className={inputCls}
              value={config.catalogo?.etiqueta?.singular ?? ""}
              onChange={(e) =>
                setCatalogo({
                  etiqueta: {
                    plural: config.catalogo?.etiqueta?.plural ?? "",
                    singular: e.target.value,
                  },
                })
              }
              placeholder="Servicio / Producto / Plato / Repuesto"
            />
          </div>
          <div>
            <label className={labelCls}>Cómo se llaman VARIOS ítems (plural)</label>
            <input
              className={inputCls}
              value={config.catalogo?.etiqueta?.plural ?? ""}
              onChange={(e) =>
                setCatalogo({
                  etiqueta: {
                    singular: config.catalogo?.etiqueta?.singular ?? "",
                    plural: e.target.value,
                  },
                })
              }
              placeholder="Servicios / Productos / Platos / Repuestos"
            />
          </div>
          <div>
            <label className={labelCls}>Camino por defecto de un ítem nuevo</label>
            <select
              className={inputCls}
              value={config.catalogo?.modoPorDefecto ?? "cita"}
              onChange={(e) =>
                setCatalogo({ modoPorDefecto: e.target.value === "pedido" ? "pedido" : "cita" })
              }
            >
              <option value="cita">Se agenda (cita/turno)</option>
              <option value="pedido">Se vende (pedido)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Cada ítem puede anular esto con su propio &quot;Camino&quot; más abajo — un
              taller mecánico agenda el service y vende el repuesto a la vez.
            </p>
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.catalogo?.campos?.duracion !== false}
                onChange={(e) => setCatalogoCampos({ duracion: e.target.checked })}
              />
              Mostrar Duración en el editor de catálogo
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.catalogo?.campos?.stock === true}
                onChange={(e) => setCatalogoCampos({ stock: e.target.checked })}
              />
              Mostrar Stock en el editor de catálogo
            </label>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section className={sectionCls}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Servicios</h2>
          <button
            type="button"
            onClick={() => set("services", [...config.services, emptyService()])}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            + Agregar servicio
          </button>
        </div>
        <div className="space-y-4">
          {config.services.map((service, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Id (kebab-case)</label>
                  <input
                    className={inputCls}
                    value={service.id}
                    onChange={(e) => setService(i, { id: e.target.value })}
                    placeholder="limpieza-facial"
                  />
                </div>
                <div>
                  <label className={labelCls}>Nombre</label>
                  <input
                    className={inputCls}
                    value={service.name}
                    onChange={(e) => setService(i, { name: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Descripción</label>
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={service.description}
                    onChange={(e) => setService(i, { description: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Precio</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={service.price}
                    onChange={(e) => setService(i, { price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Camino de este ítem</label>
                  <select
                    className={inputCls}
                    value={service.modo ?? ""}
                    onChange={(e) =>
                      setService(i, {
                        modo: e.target.value === "" ? undefined : (e.target.value as "cita" | "pedido"),
                      })
                    }
                  >
                    <option value="">Automático (según el rubro)</option>
                    <option value="cita">Se agenda (cita/turno)</option>
                    <option value="pedido">Se vende (pedido)</option>
                  </select>
                </div>
                {/* T-21: la Duración solo tiene sentido para un ítem que se
                    agenda — pedírsela a un producto es lo que dejaba a una
                    tienda sin poder cargar su catálogo. */}
                {esCita(service, config.catalogo) && (
                  <div>
                    <label className={labelCls}>Duración (minutos)</label>
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      value={service.durationMinutes ?? ""}
                      onChange={(e) =>
                        setService(i, {
                          durationMinutes:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
                {!esCita(service, config.catalogo) && (
                  <div>
                    <label className={labelCls}>Stock</label>
                    <input
                      className={inputCls}
                      type="number"
                      min={0}
                      value={service.stock ?? ""}
                      onChange={(e) =>
                        setService(i, {
                          stock: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder="Unidades disponibles"
                    />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    Palabras clave (separadas por coma)
                  </label>
                  <input
                    className={inputCls}
                    value={(service.keywords ?? []).join(", ")}
                    onChange={(e) =>
                      setService(i, {
                        keywords: e.target.value
                          .split(",")
                          .map((k) => k.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  set("services", config.services.filter((_, j) => j !== i))
                }
                className="mt-3 text-xs text-red-600 hover:underline"
              >
                Quitar servicio
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Mensajes */}
      <section className={sectionCls}>
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Mensajes del bot</h2>
        <p className="mb-4 text-xs text-slate-500">
          Variables: {"{{nombre}} {{servicio}} {{fecha}} {{negocio}} {{agenda}}"} — en
          &quot;Info de un servicio&quot; además {"{{descripcion}} {{precio}} {{duracion}}"}.
        </p>
        <div className="space-y-3">
          {(Object.keys(MESSAGE_LABELS) as (keyof BusinessConfig["messages"])[])
            .filter(
              (key) =>
                (hayItemDeCita || !MENSAJES_SOLO_CITA.has(key)) &&
                (hayItemDePedido || !MENSAJES_SOLO_PEDIDO.has(key)),
            )
            .map((key) => (
              <div key={key}>
                <label className={labelCls}>{MESSAGE_LABELS[key]}</label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={config.messages[key] ?? ""}
                  onChange={(e) => setMessage(key, e.target.value)}
                />
              </div>
            ))}
        </div>
      </section>

      {/* Persona de la IA */}
      <section className={sectionCls}>
        <h2 className="mb-1 text-sm font-semibold text-slate-800">
          Persona del bot (WhatsApp)
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Si dejas el nombre vacío, el bot responde con las plantillas directas (sin IA).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              className={inputCls}
              value={persona.name}
              onChange={(e) => setPersona({ name: e.target.value })}
              placeholder="Isabella"
            />
          </div>
          <div>
            <label className={labelCls}>Idioma</label>
            <input
              className={inputCls}
              value={persona.language}
              onChange={(e) => setPersona({ language: e.target.value })}
              placeholder="español colombiano informal"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Tono</label>
            <textarea
              className={inputCls}
              rows={2}
              value={persona.tone}
              onChange={(e) => setPersona({ tone: e.target.value })}
              placeholder="Cálida y cercana, emojis con moderación…"
            />
          </div>
        </div>
      </section>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.ok}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
