/**
 * T-106: seguimiento automático de un pedido que quedó a medias, sin spam.
 *
 * Un cliente pregunta, arma medio pedido y desaparece. Un buen vendedor le
 * escribe más tarde para retomarlo, una o dos veces, y no insiste más. Esto
 * decide CUÁNDO y QUÉ escribirle; enviarlo es del adaptador (la ruta
 * `/api/cron/seguimientos`, que llama un cron del VPS).
 *
 * Reemplaza en la práctica a `followups.ts` (umbrales de 2h/1d/3d que nunca
 * se enviaron): 1 y 3 días quedan fuera de la ventana de 24 h de WhatsApp,
 * donde Meta cobra y exige plantilla aprobada.
 *
 * Las reglas, todas a propósito:
 * - Solo si el negocio lo encendió (`config.seguimientos.activo`). Apagado
 *   por defecto: un negocio que no lo pidió no empieza a escribirle a nadie.
 * - Solo con algo PENDIENTE: un carrito o un producto elegido sin cerrar.
 *   Nunca a quien ya compró, a quien espera la respuesta de la dueña (no es
 *   culpa del cliente), ni a quien solo saludó.
 * - Máximo 2 por cada silencio del cliente (por defecto a las 2 h y a las
 *   20 h; T-113: la dueña elige otros tiempos y días sin envíos). Si el
 *   cliente responde, `handle.ts` reinicia la cuenta.
 * - Dentro de la ventana de 24 h, con margen: después Meta no deja mandar
 *   texto libre.
 * - No de noche: dentro del horario del negocio o, sin horarios cargados,
 *   de 8 a. m. a 8 p. m. Si no es buena hora, se espera al próximo cron.
 * - A quien pidió que no le escriban, nunca más (`lead.noContactar`).
 *
 * Función pura: el reloj entra por parámetro.
 */

import type { BusinessConfig, DiaAtencion, FollowUpThreshold, Lead } from "@/core/types";
import { needsFollowUp } from "@/core/engine/lead-state";
import { nombreItem } from "@/core/engine/flows/pedido";
import { etiquetaVariante } from "@/core/engine/detalles";
import { DEFAULT_TIMEZONE } from "@/core/timezone";
import { enAtencionHumana } from "@/core/engine/atencion-humana";

/**
 * Los dos seguimientos, en orden, con sus tiempos por defecto. `umbral` es
 * solo el nombre con el que se marca en `lead.followUpsSent` ("2h" = el
 * primero, "20h" = el segundo): no se cambia aunque la dueña elija otros
 * tiempos, para que los leads ya marcados se sigan leyendo bien.
 */
export const SEGUIMIENTOS: readonly { umbral: FollowUpThreshold; minutos: number }[] = [
  { umbral: "2h", minutos: 120 },
  { umbral: "20h", minutos: 20 * 60 },
];

// T-113: los tiempos elegibles viven aparte para que `config-schema.ts` los
// use sin importar todo el motor.
export { OPCIONES_PRIMERO_MIN, OPCIONES_SEGUNDO_MIN } from "@/core/engine/seguimientos-opciones";

/** Los seguimientos con los tiempos de ESTE negocio (sin el segundo si lo apagó). */
function tiemposDelNegocio(cfg: NonNullable<BusinessConfig["seguimientos"]>) {
  const [primero, segundo] = SEGUIMIENTOS;
  const segundoMin = cfg.segundoMinutos ?? segundo.minutos;
  return [
    { umbral: primero.umbral, minutos: cfg.primeroMinutos ?? primero.minutos },
    ...(segundoMin > 0 ? [{ umbral: segundo.umbral, minutos: segundoMin }] : []),
  ];
}

/** Media hora antes de que cierre la ventana de 24 h de WhatsApp. */
const VENTANA_MIN = 23 * 60 + 30;

/** Sin horarios cargados, solo de 8 a. m. a 8 p. m. (hora del negocio). */
const HORA_DESDE = 8 * 60;
const HORA_HASTA = 20 * 60;

export const SEGUIMIENTO_PRIMERO_DEFAULT =
  "Hola{{nombre}} 👋 ¿Seguimos con su pedido de {{pedido}}? Si quiere, se lo dejo listo 🙌";
export const SEGUIMIENTO_SEGUNDO_DEFAULT =
  "Hola{{nombre}}, ¿todavía le interesa {{pedido}}? Quedo pendiente por si lo quiere confirmar 😊";

/**
 * Etapas en las que el cliente dejó algo a medias. Fuera quedan "inicio" y
 * "menu_enviado" (solo saludó: escribirle sería spam), "esperando_aprobacion"
 * (espera a la dueña, no al cliente) y "datos_completos" (ya compró).
 */
const ETAPAS_PENDIENTES = new Set<Lead["stage"]>([
  "info_enviada",
  "esperando_nombre",
  "esperando_fecha",
  "esperando_confirmacion",
  "esperando_entrega",
  "esperando_direccion",
  "esperando_cantidad",
  "carrito_abierto",
]);

export interface SeguimientoDecidido {
  umbral: FollowUpThreshold;
  /** Todos los umbrales que quedan marcados como enviados (si el cron se atrasó, el de 2 h se salta). */
  marcar: FollowUpThreshold[];
  texto: string;
}

/**
 * ¿Se le puede escribir un seguimiento a este cliente? Tiene algo pendiente,
 * no pidió que no le escriban y sigue dentro de la ventana de 24 h. Lo
 * comparten el automático y el envío a mano (T-114).
 */
function puedeRecibirSeguimiento(lead: Lead, now: Date): boolean {
  if (lead.noContactar) return false;
  // T-155: la dueña lo está atendiendo; un mensaje automático en medio sobra.
  if (enAtencionHumana(lead, now)) return false;
  if (!needsFollowUp(lead.state) || !ETAPAS_PENDIENTES.has(lead.stage)) return false;
  if (!lead.items?.length && !lead.serviceId) return false;
  const minutos = minutosDesdeElCliente(lead, now);
  return minutos >= 0 && minutos < VENTANA_MIN;
}

function minutosDesdeElCliente(lead: Lead, now: Date): number {
  return (now.getTime() - new Date(lead.lastInboundAt).getTime()) / 60000;
}

export function decidirSeguimiento(lead: Lead, config: BusinessConfig, now: Date): SeguimientoDecidido | null {
  const cfg = config.seguimientos;
  if (!cfg?.activo || !puedeRecibirSeguimiento(lead, now)) return null;
  const minutos = minutosDesdeElCliente(lead, now);

  // El más avanzado que ya venció y no se mandó. Si el cron estuvo caído y
  // vencieron los dos, sale solo el segundo: dos mensajes seguidos es spam.
  const vencidos = tiemposDelNegocio(cfg).filter((s) => minutos >= s.minutos);
  const siguiente = vencidos.at(-1);
  if (!siguiente || lead.followUpsSent.includes(siguiente.umbral)) return null;

  if (!esBuenaHora(config, now)) return null;
  // T-113: un día que la dueña marcó sin envíos (p. ej. el domingo, que
  // descansa) se espera, igual que de noche.
  if (cfg.diasSinEnvio?.includes(horaLocal(now, config.timezone ?? DEFAULT_TIMEZONE).dow)) return null;

  const plantilla =
    siguiente.umbral === "2h"
      ? cfg.primero?.trim() || SEGUIMIENTO_PRIMERO_DEFAULT
      : cfg.segundo?.trim() || SEGUIMIENTO_SEGUNDO_DEFAULT;
  return {
    umbral: siguiente.umbral,
    marcar: vencidos.map((s) => s.umbral),
    texto: armarTexto(plantilla, lead, config),
  };
}

/** `{{nombre}}` → " Laura" (o nada) y `{{pedido}}` → "6 Jean Ref 102 · Talla 30 y 1 Correa". */
function armarTexto(plantilla: string, lead: Lead, config: BusinessConfig): string {
  const nombre = lead.name?.trim().split(/\s+/)[0];
  return plantilla
    .replace(/\{\{\s*nombre\s*\}\}/g, nombre ? ` ${nombre}` : "")
    .replace(/\{\{\s*pedido\s*\}\}/g, describirPedido(lead, config))
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/**
 * T-114 (temporal, para las demostraciones): los clientes a los que se les
 * puede mandar el seguimiento a mano desde Configuración. Los más recientes
 * primero, que es a quien se busca en una demo.
 */
export function candidatosSeguimiento(leads: Lead[], _config: BusinessConfig, now: Date): Lead[] {
  return leads
    .filter((l) => puedeRecibirSeguimiento(l, now))
    .sort((a, b) => new Date(b.lastInboundAt).getTime() - new Date(a.lastInboundAt).getTime());
}

/**
 * T-114: el primer mensaje, YA, a un cliente con algo pendiente. Usa el texto
 * del cuadro aunque no esté guardado (es lo que se quiere mostrar) y no mira
 * si el automático está encendido ni la hora: lo pide una persona. Queda
 * marcado como primer seguimiento para que el automático no lo repita; el
 * segundo sale a su hora. `null` si a ese cliente no se le puede escribir.
 */
export function seguimientoAhora(
  lead: Lead,
  config: BusinessConfig,
  plantilla: string | undefined,
  now: Date,
): { texto: string; lead: Lead } | null {
  if (!puedeRecibirSeguimiento(lead, now)) return null;
  const primero = SEGUIMIENTOS[0].umbral;
  return {
    texto: armarTexto(plantilla?.trim() || SEGUIMIENTO_PRIMERO_DEFAULT, lead, config),
    lead: { ...lead, followUpsSent: [...new Set([...lead.followUpsSent, primero])] },
  };
}

/** Lo que el cliente dejó a medias, en palabras: el carrito, o el producto/servicio que eligió. */
export function describirPedido(lead: Lead, config: BusinessConfig): string {
  // T-114: varias combinaciones del mismo producto se agrupan ("Jean Ref 102
  // (2 en Talla 30 y 1 en Talla 32)"): repetir el nombre en cada línea hacía
  // un mensaje largo que se leía como lista de bodega.
  const porProducto = new Map<string, NonNullable<Lead["items"]>>();
  for (const item of lead.items ?? []) {
    porProducto.set(item.serviceId, [...(porProducto.get(item.serviceId) ?? []), item]);
  }
  const partes = [...porProducto.entries()].flatMap(([serviceId, items]) => {
    const service = config.services.find((s) => s.id === serviceId);
    if (!service) return [];
    if (items.length === 1) return [`${items[0].cantidad} ${nombreItem(service, items[0].variante)}`];
    const lineas = items.map((i) =>
      i.variante !== undefined ? `${i.cantidad} en ${etiquetaVariante(service, i.variante)}` : `${i.cantidad}`,
    );
    return [`${nombreItem(service)} (${enLista(lineas)})`];
  });
  if (partes.length) return enLista(partes);
  return config.services.find((s) => s.id === lead.serviceId)?.name ?? "lo que me preguntó";
}

/** "a", "a y b", "a, b y c". */
function enLista(partes: string[]): string {
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/** ¿Es buena hora para escribirle al cliente, en la hora del negocio? */
export function esBuenaHora(config: BusinessConfig, now: Date): boolean {
  const { dow, minutos } = horaLocal(now, config.timezone ?? DEFAULT_TIMEZONE);
  const horarios: DiaAtencion[] | undefined = config.horarios;
  if (!horarios?.length) return minutos >= HORA_DESDE && minutos < HORA_HASTA;
  const dia = horarios.find((d) => d.dow === dow);
  if (!dia?.abierto) return false;
  return dia.tramos.some((t) => minutos >= aMinutos(t.desde) && minutos < aMinutos(t.hasta));
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function horaLocal(now: Date, timezone: string): { dow: number; minutos: number } {
  const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return { dow: DOW[valor("weekday")], minutos: Number(valor("hour")) * 60 + Number(valor("minute")) };
}

/**
 * ¿El cliente pidió que no le escriban más? Frases explícitas nada más: un
 * "no gracias" suelto puede ser la respuesta a "¿algo más?" y no significa
 * que no quiera saber del negocio.
 */
export function pideNoContactar(texto: string): boolean {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return (
    /\bno\s+(me\s+)?(vuelva[ns]?\s+a\s+)?(escrib\w*|molest\w*|contact\w*)\b/.test(t) ||
    /\bdej\w*\s+de\s+(escrib\w*|molest\w*|mandar\w*)\b/.test(t) ||
    /\bno\s+quiero\s+(recibir\s+)?(mas\s+)?mensajes\b/.test(t) ||
    /^\s*(stop|baja|cancelar suscripcion)\s*$/.test(t)
  );
}

/** Lo que necesita `procesarSeguimientos` del mundo exterior (canal y base), para poder probarlo sin WhatsApp. */
export interface DependenciasSeguimiento {
  enviar(lead: Lead, texto: string): Promise<void>;
  guardar(lead: Lead): Promise<void>;
}

/**
 * T-106: revisa los leads de UN negocio y manda los seguimientos que tocan.
 * Se marcan como enviados solo si el envío salió: si WhatsApp falló, el
 * próximo cron lo vuelve a intentar (todavía dentro de la ventana). Un lead
 * que falla no frena a los demás. Devuelve cuántos se mandaron.
 */
export async function procesarSeguimientos(
  leads: Lead[],
  config: BusinessConfig,
  now: Date,
  deps: DependenciasSeguimiento,
): Promise<number> {
  let enviados = 0;
  for (const lead of leads) {
    const decision = decidirSeguimiento(lead, config, now);
    if (!decision) continue;
    try {
      await deps.enviar(lead, decision.texto);
    } catch (err) {
      console.error(`[Seguimientos] no se pudo enviar a un contacto de ${config.slug}:`, err);
      continue;
    }
    enviados++;
    const marcados = new Set([...lead.followUpsSent, ...decision.marcar]);
    try {
      await deps.guardar({ ...lead, followUpsSent: [...marcados] });
    } catch (err) {
      // Ya salió el mensaje: si no se pudo anotar, el próximo cron podría
      // repetirlo. Se deja en el log para verlo; no hay forma de deshacer el envío.
      console.error(`[Seguimientos] se envió pero no se pudo anotar (${config.slug}):`, err);
    }
  }
  return enviados;
}
