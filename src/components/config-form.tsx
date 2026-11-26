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
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (backoffice.formularioConfig). */
const tt = textos.backoffice.formularioConfig;

export interface ConfigActionState {
  error?: string;
  ok?: string;
}

type ConfigAction = (
  prev: ConfigActionState,
  formData: FormData,
) => Promise<ConfigActionState>;

// El tipo exige una etiqueta por cada mensaje: si se agrega uno a BusinessConfig y falta
// en es.json, tsc lo marca acá en vez de mostrar una etiqueta vacía.
const MESSAGE_LABELS: Record<keyof BusinessConfig["messages"], string> = tt.mensajes;

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
  submitLabel = tt.guardar,
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
        <h2 className="mb-4 text-sm font-semibold text-slate-800">{tt.datosGenerales}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{tt.nombreDelNegocio}</label>
            <input
              className={inputCls}
              value={config.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{tt.moneda}</label>
            <input
              className={inputCls}
              value={config.currency}
              onChange={(e) => set("currency", e.target.value)}
              placeholder={tt.cop}
            />
          </div>
          <div>
            <label className={labelCls}>{tt.linkDeAgendaOpcional}</label>
            <input
              className={inputCls}
              value={config.bookingUrl ?? ""}
              onChange={(e) => set("bookingUrl", e.target.value || undefined)}
              placeholder={tt.httpsCalendlyCom}
            />
          </div>
        </div>
      </section>

      {/* Catálogo de este rubro (T-21) */}
      <section className={sectionCls}>
        <h2 className="mb-1 text-sm font-semibold text-slate-800">{tt.catalogoDeEsteRubro}</h2>
        <p className="mb-4 text-xs text-slate-500">{tt.quePersigueElAsistente}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{tt.comoSeLlamaUn}</label>
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
              placeholder={tt.servicioProductoPlatoRepuesto}
            />
          </div>
          <div>
            <label className={labelCls}>{tt.comoSeLlamanVarios}</label>
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
              placeholder={tt.serviciosProductosPlatosRepuestos}
            />
          </div>
          <div>
            <label className={labelCls}>{tt.caminoPorDefectoDe}</label>
            <select
              className={inputCls}
              value={config.catalogo?.modoPorDefecto ?? "cita"}
              onChange={(e) =>
                setCatalogo({ modoPorDefecto: e.target.value === "pedido" ? "pedido" : "cita" })
              }
            >
              <option value="cita">{tt.seAgendaCita}</option>
              <option value="pedido">{tt.seVendePedido}</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">{tt.cadaItemPuedeAnular}</p>
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.catalogo?.campos?.duracion !== false}
                onChange={(e) => setCatalogoCampos({ duracion: e.target.checked })}
              />{tt.mostrarDuracionEnEl}</label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.catalogo?.campos?.stock === true}
                onChange={(e) => setCatalogoCampos({ stock: e.target.checked })}
              />{tt.mostrarStockEnEl}</label>
          </div>
          {/* T-22.2: solo tiene sentido un umbral de aviso si este rubro
              muestra el campo Stock — sin stock que trackear, no hay nada
              que cruce ningún umbral. */}
          {config.catalogo?.campos?.stock === true && (
            <div>
              <label className={labelCls}>{tt.avisarCuandoElStock}</label>
              <input
                className={inputCls}
                type="number"
                min={0}
                value={config.catalogo?.stockMinimo ?? 3}
                onChange={(e) =>
                  setCatalogo({
                    stockMinimo: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
              <p className="mt-1 text-xs text-slate-500">{tt.unaSolaAlertaPor}</p>
            </div>
          )}
        </div>
      </section>

      {/* Servicios */}
      <section className={sectionCls}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">{tt.servicios}</h2>
          <button
            type="button"
            onClick={() => set("services", [...config.services, emptyService()])}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >{tt.agregarServicio}</button>
        </div>
        <div className="space-y-4">
          {config.services.map((service, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>{tt.idKebabCase}</label>
                  <input
                    className={inputCls}
                    value={service.id}
                    onChange={(e) => setService(i, { id: e.target.value })}
                    placeholder={tt.limpiezaFacial}
                  />
                </div>
                <div>
                  <label className={labelCls}>{tt.nombre}</label>
                  <input
                    className={inputCls}
                    value={service.name}
                    onChange={(e) => setService(i, { name: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{tt.descripcion}</label>
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={service.description}
                    onChange={(e) => setService(i, { description: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>{tt.precio}</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={service.price}
                    onChange={(e) => setService(i, { price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelCls}>{tt.caminoDeEsteItem}</label>
                  <select
                    className={inputCls}
                    value={service.modo ?? ""}
                    onChange={(e) =>
                      setService(i, {
                        modo: e.target.value === "" ? undefined : (e.target.value as "cita" | "pedido"),
                      })
                    }
                  >
                    <option value="">{tt.automaticoSegunElRubro}</option>
                    <option value="cita">{tt.seAgendaCita}</option>
                    <option value="pedido">{tt.seVendePedido}</option>
                  </select>
                </div>
                {/* T-21: la Duración solo tiene sentido para un ítem que se
                    agenda — pedírsela a un producto es lo que dejaba a una
                    tienda sin poder cargar su catálogo. */}
                {esCita(service, config.catalogo) && (
                  <div>
                    <label className={labelCls}>{tt.duracionMinutos}</label>
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
                    <label className={labelCls}>{tt.stock}</label>
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
                      placeholder={tt.unidadesDisponibles}
                    />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className={labelCls}>{tt.palabrasClaveSeparadasPor}</label>
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
              >{tt.quitarServicio}</button>
            </div>
          ))}
        </div>
      </section>

      {/* Mensajes */}
      <section className={sectionCls}>
        <h2 className="mb-1 text-sm font-semibold text-slate-800">{tt.mensajesDelAsistente}</h2>
        <p className="mb-4 text-xs text-slate-500">{tt.variables}{tt.nombreServicioFechaNegocio}{tt.enInfoDeUn}{tt.descripcionPrecioDuracion}.
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
        <h2 className="mb-1 text-sm font-semibold text-slate-800">{tt.personaDelAsistenteWhatsapp}</h2>
        <p className="mb-4 text-xs text-slate-500">{tt.siDejasElNombre}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{tt.nombre}</label>
            <input
              className={inputCls}
              value={persona.name}
              onChange={(e) => setPersona({ name: e.target.value })}
              placeholder={tt.isabella}
            />
          </div>
          <div>
            <label className={labelCls}>{tt.idioma}</label>
            <input
              className={inputCls}
              value={persona.language}
              onChange={(e) => setPersona({ language: e.target.value })}
              placeholder={tt.espanolColombianoInformal}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{tt.tono}</label>
            <textarea
              className={inputCls}
              rows={2}
              value={persona.tone}
              onChange={(e) => setPersona({ tone: e.target.value })}
              placeholder={tt.calidaYCercanaEmojis}
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

      {/* T-126: guardar va a la derecha, igual que en `ActionForm`. */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? tt.guardando : submitLabel}
        </button>
      </div>
    </form>
  );
}
