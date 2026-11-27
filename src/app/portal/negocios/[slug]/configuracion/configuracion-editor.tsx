"use client";

/**
 * Editor de Configuración: datos del negocio + persona del bot (nombre y tono
 * con presets Cercano/Neutral/Formal) + cerebro con IA y el conocimiento del
 * negocio (T-17: se movió acá desde "Respuestas y flujos", oculta desde T-16
 * — es el único punto donde el cliente le enseña algo al bot que no sea un
 * precio).
 */

import { useActionState, useState } from "react";
import type { FormEvent } from "react";
import { Sparkles } from "lucide-react";
import type { BotAIConfig, BusinessConfig, CuentaPago, PersonaConfig, TipoCuentaPago } from "@/core/types";
import { cuentasDeConfig } from "@/core/engine/datos-pago";
import { personaSchema } from "@/core/config-schema";
import {
  actualizarWhatsapp,
  actualizarWompi,
  guardarCatalogoPdf,
  guardarConfigParcial,
  quitarCatalogoPdf,
  quitarQrPago,
  subirQrPago,
  type ActionState,
} from "@/app/portal/actions";
import { ActionForm } from "@/components/action-form";
import { MOSTRAR_WOMPI } from "@/config/portal-scope";
import { enviarSeguimientoAhora } from "./actions";
import {
  OPCIONES_PRIMERO_MIN,
  OPCIONES_SEGUNDO_MIN,
  SEGUIMIENTO_PRIMERO_DEFAULT,
  SEGUIMIENTO_SEGUNDO_DEFAULT,
} from "@/core/engine/seguimientos";
import { Card, Pill, Segmented, Toggle } from "@/components/ui";
import { formato, textos } from "@/textos";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

/** T-130: los textos de esta pantalla viven en `src/textos/es.json`. */
const tc = textos.portal.configuracion;

/** T-113: en el orden de `Date.getDay()` (0 = domingo), igual que `diasSinEnvio`. */
const DIAS_SEMANA = tc.diasSemana;

/** 30 → "30 minutos", 60 → "1 hora", 1200 → "20 horas". */
function textoTiempo(minutos: number): string {
  if (minutos < 60) return formato(tc.tiempo.minutos, { n: minutos });
  const horas = minutos / 60;
  return horas === 1 ? tc.tiempo.unaHora : formato(tc.tiempo.horas, { n: horas });
}
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

type Tono = "cercano" | "neutral" | "formal";

const TONOS: Record<Tono, string> = {
  cercano:
    "Cálido y cercano. Usa emojis con moderación, trata al cliente de usted con calidez y responde con energía positiva.",
  neutral:
    "Claro y profesional. Directo al punto, sin emojis, amable pero conciso.",
  formal:
    "Formal y respetuoso. Trata al cliente de usted, lenguaje cuidado y sin emojis.",
};

/** T-45: sugerencias para el campo "Banco o billetera"; igual se puede escribir cualquier otro. */
const ENTIDADES = [
  "Nequi",
  "Daviplata",
  "Bancolombia",
  "Davivienda",
  "Banco de Bogotá",
  "BBVA",
  "Banco de Occidente",
  "Banco Popular",
  "Banco Caja Social",
  "AV Villas",
  "Nu",
  "Lulo Bank",
  "Bre-B",
];

const TIPOS_CUENTA: { value: TipoCuentaPago; label: string }[] = [
  { value: "billetera", label: tc.tiposCuenta.billetera },
  { value: "ahorros", label: tc.tiposCuenta.ahorros },
  { value: "corriente", label: tc.tiposCuenta.corriente },
  { value: "llave", label: tc.tiposCuenta.llave },
  { value: "pago_movil", label: tc.tiposCuenta.pago_movil },
];

const CUENTA_VACIA: CuentaPago = { entidad: "", tipo: "billetera", numero: "", titular: "" };
const MAX_CUENTAS = 6; // mismo tope que el schema

function tonoActual(tone: string): Tono {
  // T-79: el preset "Cercano" ahora también dice "usted", así que se
  // reconoce antes que "formal". El viejo ("tutea al cliente") cae en el
  // `return "cercano"` del final: al guardar se reemplaza por el nuevo.
  if (/cálido y cercano/i.test(tone)) return "cercano";
  if (/formal|usted/i.test(tone)) return "formal";
  if (/claro y profesional|neutral|conciso/i.test(tone)) return "neutral";
  return "cercano";
}

/**
 * T-73: el <input type="file"> nativo sale con el idioma del navegador
 * ("Choose File · No file chosen") y en un celular angosto se salía de la
 * tarjeta. Se esconde y se reemplaza por un botón en español con el nombre
 * del archivo elegido.
 */
function SelectorImagen({
  name,
  accept = "image/png,image/jpeg,image/webp",
  etiqueta = textos.comun.elegirImagen,
}: {
  name: string;
  /** T-121: el mismo selector sirve para el PDF del catálogo. */
  accept?: string;
  etiqueta?: string;
}) {
  const [archivo, setArchivo] = useState<string | null>(null);
  return (
    <label className="flex min-w-0 cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-line-input px-3 py-2.5 text-sm transition-colors hover:bg-surface-3">
      <input
        type="file"
        name={name}
        accept={accept}
        className="sr-only"
        onChange={(e) => setArchivo(e.target.files?.[0]?.name ?? null)}
      />
      <span className="shrink-0 font-semibold text-primary">{etiqueta}</span>
      <span className="min-w-0 truncate text-ink-soft">{archivo ?? textos.comun.ningunArchivoElegido}</span>
    </label>
  );
}

export function ConfiguracionEditor({
  slug,
  nombre,
  rubro,
  whatsappId,
  direccion: direccionInicial,
  notifyPhoneNumber: notifyPhoneNumberInicial,
  persona,
  personas,
  initialAi,
  initialPagos,
  initialAvisos,
  catalogoPdf,
  initialSeguimientos,
  initialCatalogo,
  initialResumenDiario,
  candidatosSeguimiento,
}: {
  slug: string;
  nombre: string;
  rubro: string;
  whatsappId: string;
  direccion: string;
  notifyPhoneNumber: string;
  persona: PersonaConfig;
  personas: BusinessConfig["personas"];
  initialAi: BotAIConfig;
  initialPagos: BusinessConfig["pagos"];
  initialAvisos: BusinessConfig["avisos"];
  /** T-121: se guarda aparte (sube un archivo), igual que el QR. */
  catalogoPdf: BusinessConfig["catalogoPdf"];
  initialSeguimientos: BusinessConfig["seguimientos"];
  initialCatalogo: BusinessConfig["catalogo"];
  initialResumenDiario: BusinessConfig["resumenDiario"];
  /** T-114: clientes con un pedido a medias a los que se les puede escribir ya. */
  candidatosSeguimiento: { id: string; etiqueta: string }[];
}) {
  // T-110: el rubro decide si se ven la referencia y los detalles en el
  // menú; la dueña los puede cambiar aquí (una heladería con sabores).
  const [resumenDiario, setResumenDiario] = useState(initialResumenDiario?.activo === true);
  const [campoReferencia, setCampoReferencia] = useState(initialCatalogo?.campos?.referencia === true);
  const [campoDetalles, setCampoDetalles] = useState(initialCatalogo?.campos?.detalles === true);
  // T-106: apagado por defecto. Los textos vacíos usan los del sistema.
  const [seguimientos, setSeguimientos] = useState({
    activo: initialSeguimientos?.activo ?? false,
    primero: initialSeguimientos?.primero ?? "",
    segundo: initialSeguimientos?.segundo ?? "",
    // T-113: sin elegir = los tiempos de siempre (2 h y 20 h), todos los días.
    primeroMinutos: initialSeguimientos?.primeroMinutos ?? 120,
    segundoMinutos: initialSeguimientos?.segundoMinutos ?? 1200,
    diasSinEnvio: initialSeguimientos?.diasSinEnvio ?? [],
  });
  const [direccion, setDireccion] = useState(direccionInicial);
  const [notifyPhoneNumber, setNotifyPhoneNumber] = useState(notifyPhoneNumberInicial);
  const [wompiEnabled, setWompiEnabled] = useState(initialPagos?.wompi?.enabled ?? false);
  // T-39: cuánto le llega por WhatsApp en un día de muchos pedidos.
  const [modoAviso, setModoAviso] = useState<"cada_pedido" | "resumen">(
    initialAvisos?.modo ?? "cada_pedido",
  );
  const [minutosResumen, setMinutosResumen] = useState(initialAvisos?.cadaMinutos ?? 10);
  // T-33: cobro con comprobante (Nequi / Bre-B). El número de Nequi también
  // alimenta la señal "destino no coincide" si no hay `telefonoDestino`
  // cargado aparte (los negocios anteriores a T-33 pueden tenerlo).
  const [requiereComprobante, setRequiereComprobante] = useState(
    initialPagos?.requiereComprobante ?? false,
  );
  // T-45: varias cuentas (antes un solo Nequi). Los negocios viejos llegan
  // con `datosPago` y se muestran ya convertidos a cuentas.
  const [cuentas, setCuentas] = useState<CuentaPago[]>(() => {
    const iniciales = cuentasDeConfig(initialPagos);
    return iniciales.length ? iniciales : [CUENTA_VACIA];
  });
  const cambiarCuenta = (i: number, campo: keyof CuentaPago, valor: string) =>
    setCuentas((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
  const [wompiRedirectUrl, setWompiRedirectUrl] = useState(
    initialPagos?.wompi?.redirectUrl ?? "",
  );
  const [botName, setBotName] = useState(persona.name);
  const [tono, setTono] = useState<Tono>(tonoActual(persona.tone));
  const [botNameError, setBotNameError] = useState<string>();
  // Copia completa de `initialAi` (T-17): reglas/botonesMenu/derivarHumano/
  // modo no se muestran acá, pero hay que preservarlos al guardar — este
  // editor y el de "Respuestas y flujos" (oculto, no borrado) escriben al
  // mismo `config.ai`, y guardarConfigParcial reemplaza la clave entera.
  const [ai, setAi] = useState<BotAIConfig>(initialAi);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    guardarConfigParcial,
    {},
  );

  const nuevaPersona = { ...persona, name: botName, tone: TONOS[tono] };
  const patch = {
    direccion: direccion || undefined,
    notifyPhoneNumber: notifyPhoneNumber.trim() || undefined,
    avisos: { modo: modoAviso, cadaMinutos: minutosResumen },
    // Se copia el bloque entero: `guardarConfigParcial` reemplaza la clave y
    // no se deben perder la etiqueta, el modo ni los otros campos del rubro.
    catalogo: {
      ...initialCatalogo,
      campos: { ...initialCatalogo?.campos, referencia: campoReferencia, detalles: campoDetalles },
    },
    resumenDiario: { activo: resumenDiario },
    seguimientos: {
      activo: seguimientos.activo,
      primero: seguimientos.primero.trim() || undefined,
      segundo: seguimientos.segundo.trim() || undefined,
      primeroMinutos: seguimientos.primeroMinutos,
      segundoMinutos: seguimientos.segundoMinutos,
      diasSinEnvio: seguimientos.diasSinEnvio.length ? seguimientos.diasSinEnvio : undefined,
    },
    personas: { ...personas, whatsapp: nuevaPersona },
    ai,
    pagos: {
      ...initialPagos,
      requiereComprobante,
      // `datosPago` y `telefonoDestino` quedan reemplazados por `cuentas`.
      telefonoDestino: undefined,
      datosPago: undefined,
      cuentas: cuentas
        .filter((c) => c.entidad.trim() && c.numero.trim())
        .map((c) => ({
          entidad: c.entidad.trim(),
          tipo: c.tipo,
          numero: c.numero.trim(),
          titular: c.titular?.trim() || undefined,
          documento: c.documento?.trim() || undefined,
        })),
      wompi: { enabled: wompiEnabled, redirectUrl: wompiRedirectUrl.trim() || undefined },
    },
  };

  /**
   * Mismo schema que valida `guardarConfigParcial` en el servidor (T-12):
   * antes había un fallback silencioso a "Asistente" cuando el nombre
   * quedaba vacío — con eso el servidor nunca veía un nombre inválido. Ahora
   * el error se ve al toque, sin ida y vuelta.
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const result = personaSchema.safeParse(nuevaPersona);
    if (result.success) {
      setBotNameError(undefined);
      return;
    }
    e.preventDefault();
    setBotNameError(result.error.issues[0]?.message);
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-4 fade-up">
      {/* Datos del negocio */}
      <Card title={tc.datosNegocio.titulo}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>{tc.datosNegocio.nombre}</label>
            <input
              className={`${inputCls} bg-surface-3 text-ink-mid`}
              value={nombre}
              readOnly
            />
          </div>
          <div>
            <label className={labelCls}>{tc.datosNegocio.rubro}</label>
            <div className="pt-1.5">
              <Pill tone="info">{rubro}</Pill>
            </div>
          </div>
          <div>
            <label className={labelCls}>{tc.datosNegocio.direccion}</label>
            <input
              className={inputCls}
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder={tc.datosNegocio.direccionEjemplo}
            />
          </div>
        </div>
      </Card>

      {/* WhatsApp conectado (action propia: columna, no config) */}
      <Card
        title={tc.whatsapp.titulo}
        subtitle={tc.whatsapp.subtitulo}
      >
        <ActionForm action={actualizarWhatsapp} submitLabel={tc.whatsapp.guardar}>
          <input type="hidden" name="slug" value={slug} />
          <div className="relative max-w-sm">
            {whatsappId && (
              <span className="pointer-events-none absolute left-3.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-success" />
            )}
            <input
              name="whatsapp_phone_number_id"
              defaultValue={whatsappId}
              className={`${inputCls} ${whatsappId ? "border-success bg-success-bg pl-8" : ""}`}
              placeholder={tc.whatsapp.ejemplo}
            />
          </div>
        </ActionForm>
      </Card>

      {/* T-110: referencia y detalles en el menú */}
      <Card
        title={tc.referencias.titulo}
        subtitle={tc.referencias.subtitulo}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{tc.referencias.referencia}</span>
            <Toggle checked={campoReferencia} onChange={setCampoReferencia} label={tc.referencias.referenciaInterruptor} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{tc.referencias.detalles}</span>
            <Toggle checked={campoDetalles} onChange={setCampoDetalles} label={tc.referencias.detallesInterruptor} />
          </div>
          <p className="text-xs text-ink-soft">{tc.referencias.ayuda}</p>
        </div>
      </Card>

      {/* T-106: seguimiento automático de pedidos a medias */}
      <Card
        title={tc.seguimiento.titulo}
        subtitle={tc.seguimiento.subtitulo}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{tc.seguimiento.retomar}</span>
          <Toggle
            checked={seguimientos.activo}
            onChange={(next) => setSeguimientos((prev) => ({ ...prev, activo: next }))}
            label={tc.seguimiento.interruptor}
          />
        </div>
        {seguimientos.activo && (
          <div className="mt-4 space-y-3">
            {/* T-113: cuándo sale cada mensaje y qué días no. Solo opciones
                dentro de la ventana de 24 h de WhatsApp. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="seg-primero-min">{tc.seguimiento.primerMensaje}</label>
                <select
                  id="seg-primero-min"
                  className={inputCls}
                  value={seguimientos.primeroMinutos}
                  onChange={(e) => setSeguimientos((prev) => ({ ...prev, primeroMinutos: Number(e.target.value) }))}
                >
                  {OPCIONES_PRIMERO_MIN.map((m) => (
                    <option key={m} value={m}>
                      {formato(tc.tiempo.despues, { tiempo: textoTiempo(m) })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="seg-segundo-min">{tc.seguimiento.segundoMensaje}</label>
                <select
                  id="seg-segundo-min"
                  className={inputCls}
                  value={seguimientos.segundoMinutos}
                  onChange={(e) => setSeguimientos((prev) => ({ ...prev, segundoMinutos: Number(e.target.value) }))}
                >
                  {OPCIONES_SEGUNDO_MIN.map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? tc.seguimiento.sinSegundo : formato(tc.tiempo.despues, { tiempo: textoTiempo(m) })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <p className={labelCls}>{tc.seguimiento.diasSinEnvio}</p>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((nombre, dow) => {
                  const pausado = seguimientos.diasSinEnvio.includes(dow);
                  return (
                    <button
                      key={nombre}
                      type="button"
                      aria-pressed={pausado}
                      onClick={() =>
                        setSeguimientos((prev) => ({
                          ...prev,
                          diasSinEnvio: pausado
                            ? prev.diasSinEnvio.filter((d) => d !== dow)
                            : [...prev.diasSinEnvio, dow].sort(),
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${
                        pausado ? "border-warn-ink bg-warn-bg text-warn-ink line-through" : "border-line text-ink"
                      }`}
                    >
                      {nombre}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-ink-soft">{tc.seguimiento.ayudaDias}</p>
            </div>
            <div>
              <label className={labelCls}>{tc.seguimiento.textoPrimero}</label>
              <textarea
                className={inputCls}
                rows={2}
                maxLength={500}
                value={seguimientos.primero}
                onChange={(e) => setSeguimientos((prev) => ({ ...prev, primero: e.target.value }))}
                placeholder={SEGUIMIENTO_PRIMERO_DEFAULT}
              />
            </div>
            <div>
              <label className={labelCls}>{tc.seguimiento.textoSegundo}</label>
              <textarea
                className={inputCls}
                rows={2}
                maxLength={500}
                value={seguimientos.segundo}
                onChange={(e) => setSeguimientos((prev) => ({ ...prev, segundo: e.target.value }))}
                placeholder={SEGUIMIENTO_SEGUNDO_DEFAULT}
              />
            </div>
            <p className="text-xs text-ink-soft">{tc.seguimiento.ayudaTextos}</p>
            {/* T-114 (temporal, para las demos): mandarle el primer mensaje YA a
                un cliente con un pedido a medias, con el texto del cuadro. */}
            <ActionForm action={enviarSeguimientoAhora} submitLabel={tc.seguimiento.enviarAhora} className="space-y-2 border-t border-line pt-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="primero" value={seguimientos.primero} />
              <label className={labelCls} htmlFor="seg-cliente">{tc.seguimiento.probarConCliente}</label>
              {candidatosSeguimiento.length > 0 ? (
                <select id="seg-cliente" name="leadId" className={inputCls} defaultValue={candidatosSeguimiento[0].id}>
                  {candidatosSeguimiento.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.etiqueta}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-ink-mid">{tc.seguimiento.sinCandidatos}</p>
              )}
              <p className="text-xs text-ink-mid">{tc.seguimiento.ayudaEnviarAhora}</p>
            </ActionForm>
          </div>
        )}
      </Card>

      {/* Notificaciones */}
      <Card
        title={tc.notificaciones.titulo}
        subtitle={tc.notificaciones.subtitulo}
      >
        <div className="max-w-sm">
          <label className={labelCls}>{tc.notificaciones.numero}</label>
          <input
            className={inputCls}
            value={notifyPhoneNumber}
            onChange={(e) => setNotifyPhoneNumber(e.target.value)}
            placeholder={tc.notificaciones.numeroEjemplo}
          />
          <p className="mt-1.5 text-xs text-ink-soft">{tc.notificaciones.ayudaNumero}</p>
        </div>
        {/* Resumen del día al cierre (core/engine/ventas-del-dia.ts). */}
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-line p-3">
          <span className="text-sm text-ink">
            <span className="font-semibold">{tc.notificaciones.resumenDiario}</span>
            <span className="block text-xs text-ink-mid">{tc.notificaciones.ayudaResumenDiario}</span>
          </span>
          <Toggle checked={resumenDiario} onChange={setResumenDiario} label={tc.notificaciones.resumenDiario} />
        </div>
        <fieldset className="mt-5 space-y-2">
          <legend className={labelCls}>{tc.notificaciones.avisosPedidos}</legend>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="modo-aviso"
              checked={modoAviso === "cada_pedido"}
              onChange={() => setModoAviso("cada_pedido")}
              className="mt-1"
            />
            <span>
              <b>{tc.notificaciones.unoPorPedido}</b>
              {tc.notificaciones.unoPorPedidoDetalle}
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="modo-aviso"
              checked={modoAviso === "resumen"}
              onChange={() => setModoAviso("resumen")}
              className="mt-1"
            />
            <span>
              <b>{tc.notificaciones.soloResumen}</b>
              {tc.notificaciones.cada}{" "}
              <select
                aria-label={tc.notificaciones.minutosEntreResumenes}
                value={minutosResumen}
                onChange={(e) => setMinutosResumen(Number(e.target.value))}
                className="input-nexo px-2 py-1 text-sm"
              >
                {[5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {formato(tc.notificaciones.minutos, { n: m })}
                  </option>
                ))}
              </select>{" "}
              {tc.notificaciones.soloResumenDetalle}
            </span>
          </label>
        </fieldset>
      </Card>

      {/* Cobro con comprobante (T-33): el camino que funciona en cualquier
          país y sin cuenta de comercio. El bot le da estos datos al cliente y
          le pide la foto; la plata la verifica la dueña en su app del banco. */}
      <Card
        title={tc.cobro.titulo}
        subtitle={tc.cobro.subtitulo}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{tc.cobro.pedirComprobante}</span>
            <Toggle
              checked={requiereComprobante}
              onChange={setRequiereComprobante}
              label={tc.cobro.pedirComprobanteInterruptor}
            />
          </div>
          <div className="space-y-3">
            {cuentas.map((cuenta, i) => (
              <div key={i} className="rounded-xl border border-line p-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor={`cuenta-entidad-${i}`}>{tc.cobro.banco}</label>
                    <input
                      id={`cuenta-entidad-${i}`}
                      list="entidades-pago"
                      className={inputCls}
                      value={cuenta.entidad}
                      onChange={(e) => cambiarCuenta(i, "entidad", e.target.value)}
                      placeholder={tc.cobro.bancoEjemplo}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`cuenta-tipo-${i}`}>{tc.cobro.tipo}</label>
                    <select
                      id={`cuenta-tipo-${i}`}
                      className={inputCls}
                      value={cuenta.tipo}
                      onChange={(e) => cambiarCuenta(i, "tipo", e.target.value)}
                    >
                      {TIPOS_CUENTA.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`cuenta-numero-${i}`}>
                      {cuenta.tipo === "llave" ? tc.cobro.llave : cuenta.tipo === "billetera" || cuenta.tipo === "pago_movil" ? tc.cobro.numeroCelular : tc.cobro.numeroCuenta}
                    </label>
                    <input
                      id={`cuenta-numero-${i}`}
                      className={inputCls}
                      value={cuenta.numero}
                      onChange={(e) => cambiarCuenta(i, "numero", e.target.value)}
                      placeholder={cuenta.tipo === "llave" ? tc.cobro.llaveEjemplo : cuenta.tipo === "billetera" || cuenta.tipo === "pago_movil" ? tc.cobro.celularEjemplo : tc.cobro.cuentaEjemplo}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`cuenta-titular-${i}`}>{tc.cobro.titular}</label>
                    <input
                      id={`cuenta-titular-${i}`}
                      className={inputCls}
                      value={cuenta.titular ?? ""}
                      onChange={(e) => cambiarCuenta(i, "titular", e.target.value)}
                      placeholder={tc.cobro.titularEjemplo}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`cuenta-doc-${i}`}>{tc.cobro.documento}</label>
                    <input
                      id={`cuenta-doc-${i}`}
                      className={inputCls}
                      value={cuenta.documento ?? ""}
                      onChange={(e) => cambiarCuenta(i, "documento", e.target.value)}
                      placeholder={tc.cobro.documentoEjemplo}
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    {cuentas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCuentas((cs) => cs.filter((_, j) => j !== i))}
                        className="rounded-[10px] px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        {tc.cobro.quitarCuenta}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <datalist id="entidades-pago">
              {ENTIDADES.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
            {cuentas.length < MAX_CUENTAS && (
              <button
                type="button"
                onClick={() => setCuentas((cs) => [...cs, CUENTA_VACIA])}
                className="rounded-[10px] bg-primary-tint px-3.5 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-white"
              >
                {tc.cobro.agregarCuenta}
              </button>
            )}
          </div>
          <p className="text-xs text-ink-soft">{tc.cobro.ayudaCuentas}</p>

          {/* El QR se guarda aparte (sube un archivo), igual que las llaves de Wompi. */}
          <div className="border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink">{tc.cobro.qrTitulo}</p>
            <p className="mt-0.5 text-xs text-ink-soft">{tc.cobro.qrAyuda}</p>
            {initialPagos?.qrUrl && (
              <div className="mt-3 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen de Storage, sin optimizar a propósito */}
                <img src={initialPagos.qrUrl} alt={tc.cobro.qrActual} className="h-28 w-28 rounded-lg border border-line object-contain" />
                <ActionForm action={quitarQrPago} submitLabel={tc.cobro.quitarQr}>
                  <input type="hidden" name="slug" value={slug} />
                </ActionForm>
              </div>
            )}
            <ActionForm action={subirQrPago} submitLabel={initialPagos?.qrUrl ? tc.cobro.cambiarQr : tc.cobro.subirQr} className="mt-3 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <SelectorImagen name="qr" />
            </ActionForm>
          </div>
        </div>
      </Card>

      {/* T-121: catálogo en PDF. Se guarda con su propio botón (sube un
          archivo), como el QR; el "Guardar cambios" de abajo no lo toca. */}
      <Card title={tc.catalogoPdf.titulo} subtitle={tc.catalogoPdf.subtitulo}>
        <div className="space-y-3">
          {catalogoPdf && (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={catalogoPdf.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                📄 {catalogoPdf.nombreArchivo}
              </a>
              <Pill tone={catalogoPdf.enviarAlSaludar ? "success" : "neutral"}>
                {catalogoPdf.enviarAlSaludar ? tc.catalogoPdf.seEnviaAlSaludar : tc.catalogoPdf.soloSiLoPiden}
              </Pill>
              <ActionForm action={quitarCatalogoPdf} submitLabel={tc.catalogoPdf.quitar}>
                <input type="hidden" name="slug" value={slug} />
              </ActionForm>
            </div>
          )}
          <ActionForm
            action={guardarCatalogoPdf}
            submitLabel={catalogoPdf ? tc.catalogoPdf.guardar : tc.catalogoPdf.subir}
            className="space-y-3"
          >
            <input type="hidden" name="slug" value={slug} />
            <SelectorImagen
              name="catalogo"
              accept="application/pdf"
              etiqueta={catalogoPdf ? tc.catalogoPdf.cambiarPdf : tc.catalogoPdf.elegirPdf}
            />
            <p className="rounded-[10px] bg-warn-bg px-3 py-2 text-xs text-warn-ink">{tc.catalogoPdf.avisoPublico}</p>
            <div className="max-w-sm">
              <label className={labelCls} htmlFor="catalogo-nombre">
                {tc.catalogoPdf.nombreVisible}
              </label>
              <input
                id="catalogo-nombre"
                name="nombreArchivo"
                maxLength={120}
                defaultValue={catalogoPdf?.nombreArchivo ?? ""}
                placeholder={tc.catalogoPdf.nombreEjemplo}
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                name="enviarAlSaludar"
                defaultChecked={catalogoPdf?.enviarAlSaludar ?? false}
                className="h-4 w-4 accent-primary"
              />
              {tc.catalogoPdf.enviarAlSaludar}
            </label>
            <p className="text-xs text-ink-soft">{tc.catalogoPdf.ayudaApagado}</p>
          </ActionForm>
        </div>
      </Card>

      {/* T-128: escondida mientras no se use Wompi (ver `MOSTRAR_WOMPI`). */}
      {MOSTRAR_WOMPI && (
        <>
          {/* Pagos con Wompi (T-24.6): Wompi solo cubre Colombia — para otros
              países (ej. Venezuela) queda el camino de comprobante manual, que no
              depende de esta pantalla. */}
          <Card
            title={tc.wompi.titulo}
            subtitle={tc.wompi.subtitulo}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">{tc.wompi.activar}</span>
                <Toggle checked={wompiEnabled} onChange={setWompiEnabled} label={tc.wompi.interruptor} />
              </div>
              <div className="max-w-sm">
                <label className={labelCls}>{tc.wompi.redireccion}</label>
                <input
                  className={inputCls}
                  value={wompiRedirectUrl}
                  onChange={(e) => setWompiRedirectUrl(e.target.value)}
                  placeholder={tc.wompi.redireccionEjemplo}
                />
                <p className="mt-1.5 text-xs text-ink-soft">{tc.wompi.ayudaRedireccion}</p>
              </div>

              <div className="border-t border-line pt-4">
                <ActionForm action={actualizarWompi} submitLabel={tc.wompi.guardarCredenciales}>
                  <input type="hidden" name="slug" value={slug} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>{tc.wompi.llavePublica}</label>
                      <input
                        name="public_key"
                        className={inputCls}
                        placeholder="pub_prod_..."
                        autoComplete="off"
                        data-1p-ignore
                        data-lpignore="true"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{tc.wompi.secretoIntegridad}</label>
                      <input
                        name="integrity_secret"
                        type="password"
                        className={inputCls}
                        placeholder="•••••••••••"
                        // T-49: Chrome ignora "off" en campos de contraseña y metía
                        // la clave de la dueña; "new-password" sí lo frena.
                        autoComplete="new-password"
                        data-1p-ignore
                        data-lpignore="true"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{tc.wompi.secretoEventos}</label>
                      <input
                        name="events_secret"
                        type="password"
                        className={inputCls}
                        placeholder="•••••••••••"
                        // T-49: Chrome ignora "off" en campos de contraseña y metía
                        // la clave de la dueña; "new-password" sí lo frena.
                        autoComplete="new-password"
                        data-1p-ignore
                        data-lpignore="true"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-ink-soft">{tc.wompi.ayudaLlaves}</p>
                </ActionForm>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* El bot */}
      <Card title={tc.asistente.titulo}>
        <div className="space-y-4">
          <div className="max-w-sm">
            <label className={labelCls}>{tc.asistente.nombre}</label>
            <input
              className={`${inputCls} ${botNameError ? "border-warn-ink" : ""}`}
              value={botName}
              onChange={(e) => {
                setBotName(e.target.value);
                if (botNameError) setBotNameError(undefined);
              }}
              placeholder={tc.asistente.nombreEjemplo}
            />
            {botNameError && (
              <p className="mt-1 text-xs text-warn-ink">{botNameError}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>{tc.asistente.tono}</label>
            <Segmented<Tono>
              options={[
                { value: "cercano", label: tc.asistente.tonos.cercano },
                { value: "neutral", label: tc.asistente.tonos.neutral },
                { value: "formal", label: tc.asistente.tonos.formal },
              ]}
              value={tono}
              onChange={setTono}
              className="max-w-sm"
            />
            <p className="mt-2 text-xs text-ink-soft">{TONOS[tono]}</p>
          </div>

          {/* Cerebro con IA + conocimiento del negocio (T-17) */}
          <div className="border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary-tint text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-ink">{tc.asistente.cerebroIa}</span>
              </span>
              <Toggle
                checked={ai.enabled}
                onChange={(next) => setAi((prev) => ({ ...prev, enabled: next }))}
                label={tc.asistente.iaInterruptor}
              />
            </div>
            <label className={labelCls}>{tc.asistente.informacion}</label>
            <textarea
              className={inputCls}
              rows={4}
              value={ai.knowledge ?? ""}
              onChange={(e) => setAi((prev) => ({ ...prev, knowledge: e.target.value }))}
              placeholder={tc.asistente.informacionEjemplo}
            />
            <p className="mt-1.5 text-xs text-ink-soft">{tc.asistente.ayudaInformacion}</p>
            {/* T-105: "sin arroz, sin salsa". Encendido por defecto (undefined = sí). */}
            <div className="mt-4 flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-ink">{tc.asistente.cambiosProductos}</span>
                <span className="block text-xs text-ink-soft">{tc.asistente.ayudaCambiosProductos}</span>
              </span>
              <Toggle
                checked={ai.cambiosEnProductos !== false}
                onChange={(next) => setAi((prev) => ({ ...prev, cambiosEnProductos: next }))}
                label={tc.asistente.cambiosProductos}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Guardar */}
      <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="patch" value={JSON.stringify(patch)} />
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
        {/* T-126: guardar va a la derecha, como cierre del formulario. */}
        <div className="flex sm:justify-end">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[10px] bg-primary py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {pending ? textos.comun.guardando : textos.comun.guardarCambios}
          </button>
        </div>
      </form>
    </div>
  );
}
