/**
 * Flujo de pedido (T-21): carrito de uno o más productos con cantidad y
 * total. Es lo que reemplaza a "fecha + confirmar" cuando el ítem elegido no
 * es una cita (ver `modoDelItem`). Funciones puras — `responder.ts` es quien
 * las usa para decidir la respuesta y actualizar el lead.
 */

import type { BusinessConfig, CartItem, Service } from "@/core/types";
import { detallesDe, etiquetaVariante, leerDetalles } from "@/core/engine/detalles";
import { formatoPrecio } from "@/core/moneda";

/**
 * Formatea un precio según la moneda/locale del negocio. Duplicado a
 * propósito (mismo criterio que `responder.ts` y `ai/agent-prompt.ts`):
 * importar el de `responder.ts` acá crearía un ciclo, porque `responder.ts`
 * es quien importa este módulo.
 */
function formatPrice(config: BusinessConfig, price: number): string {
  return formatoPrecio(price, config.currency, config.locale);
}

/**
 * T-104: una línea del carrito es un producto EN una variante. Sin variante
 * (`undefined`) es otra línea: la de un producto sin opciones, o la que
 * espera que el cliente diga la talla.
 */
function mismaLinea(item: CartItem, serviceId: string, variante: string | undefined): boolean {
  return item.serviceId === serviceId && item.variante === variante;
}

/** Quita `variante` cuando no hay (así el carrito de un producto sin opciones queda igual que antes de T-104). */
function linea(serviceId: string, cantidad: number, variante: string | undefined): CartItem {
  return variante === undefined ? { serviceId, cantidad } : { serviceId, cantidad, variante };
}

/**
 * T-55: deja la cantidad de un producto en `cantidad` (no la suma). Es lo
 * que significa "guardar_cantidad" en modo agente: en la prueba real el
 * cliente dijo "una bandeja", después "ya te dije que 1", y la suma dejó 2.
 *
 * T-104: por variante. Al llegar la talla, la línea del mismo producto que
 * la esperaba (sin variante) se reemplaza: "6 jeans" y después "de la 30"
 * son 6 de la 30, no 6 sin talla más 6 de la 30.
 */
export function fijarCantidad(
  items: CartItem[] | undefined,
  serviceId: string,
  cantidad: number,
  variante?: string,
): CartItem[] {
  let actuales = items ?? [];
  // T-105: la nota de la línea que esperaba talla ("sin bolsillo") pasa a la
  // línea con talla; si no, el cambio que pidió el cliente se perdería.
  const notaPendiente =
    variante !== undefined ? actuales.find((i) => mismaLinea(i, serviceId, undefined))?.nota : undefined;
  if (variante !== undefined) actuales = actuales.filter((i) => !mismaLinea(i, serviceId, undefined));
  if (actuales.some((i) => mismaLinea(i, serviceId, variante))) {
    return actuales.map((i) => (mismaLinea(i, serviceId, variante) ? { ...i, cantidad } : i));
  }
  const nueva = linea(serviceId, cantidad, variante);
  return [...actuales, notaPendiente ? { ...nueva, nota: notaPendiente } : nueva];
}

/**
 * Agrega `cantidad` unidades de `serviceId` al carrito. Si el producto ya
 * estaba cargado (en la misma variante), SUMA la cantidad en la misma línea
 * en vez de duplicarla: "2 harinas" y después "una más" terminan en 3.
 */
export function agregarAlCarrito(
  items: CartItem[] | undefined,
  serviceId: string,
  cantidad: number,
  variante?: string,
): CartItem[] {
  const actuales = items ?? [];
  if (actuales.some((i) => mismaLinea(i, serviceId, variante))) {
    return actuales.map((i) =>
      mismaLinea(i, serviceId, variante) ? { ...i, cantidad: i.cantidad + cantidad } : i,
    );
  }
  return [...actuales, linea(serviceId, cantidad, variante)];
}

/** Largo máximo de una nota (T-105): lo justo para "sin arroz, sin ensalada y la carne bien asada". */
export const MAX_NOTA = 140;

/**
 * T-105: deja la nota lista para guardar: sin espacios de más, sin un
 * "nota:" adelante y con un largo razonable. Vacía → `undefined`.
 */
export function limpiarNota(texto: string): string | undefined {
  const limpia = texto
    .replace(/\s+/g, " ")
    .replace(/^\s*(nota|cambio|observaci[oó]n)\s*:\s*/i, "")
    .trim()
    .slice(0, MAX_NOTA)
    .trim();
  return limpia || undefined;
}

/**
 * T-105: pone (o reemplaza) la nota de un producto del carrito. Con
 * `variante`, solo en esa línea; sin ella, en todas las del producto (un
 * plato sin opciones tiene una sola). La nota nueva reemplaza la anterior:
 * la IA manda la indicación completa, igual que la cantidad en `fijarCantidad`.
 */
export function anotarCambio(
  items: CartItem[] | undefined,
  serviceId: string,
  nota: string | undefined,
  variante?: string,
): CartItem[] {
  return (items ?? []).map((i) => {
    const corresponde = i.serviceId === serviceId && (variante === undefined || i.variante === variante);
    if (!corresponde) return i;
    const actualizado: CartItem = { ...i, nota };
    if (!nota) delete actualizado.nota;
    return actualizado;
  });
}

/**
 * T-105: ¿la nota AGREGA algo ("doble queso", "extra papas")? Quitar no
 * cuesta; agregar puede costar, y eso no lo cobra el bot solo: se anota y se
 * le avisa al cliente que el negocio lo confirma.
 */
export function esAgregado(nota: string): boolean {
  const t = sinTildes(nota);
  return /\b(extra|doble|adicional|agreg\w*|anad\w*|con mas|mas de|aparte)\b/.test(t);
}

/** T-104: saca una variante del producto ("quite la talla 30"), o el producto entero si no se dice cuál. */
export function quitarDelCarrito(items: CartItem[] | undefined, serviceId: string, variante?: string): CartItem[] {
  return (items ?? []).filter((i) =>
    variante === undefined ? i.serviceId !== serviceId : !mismaLinea(i, serviceId, variante),
  );
}

/**
 * T-104: cantidad total por producto, sumando sus variantes. El inventario
 * lleva stock por producto (no por talla): si se le pasaran dos líneas del
 * mismo jean, la base revisaría cada una contra el stock completo por
 * separado y podría dejarlo en negativo.
 */
export function cantidadesPorProducto(items: CartItem[]): { serviceId: string; cantidad: number }[] {
  const porProducto = new Map<string, number>();
  for (const i of items) porProducto.set(i.serviceId, (porProducto.get(i.serviceId) ?? 0) + i.cantidad);
  return [...porProducto].map(([serviceId, cantidad]) => ({ serviceId, cantidad }));
}

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * T-104: cómo se nombra una línea en el resumen, el aviso a la dueña y el
 * panel: "Jean clásico Ref 102 · Talla 30". La referencia no se repite si el
 * dueño ya la puso en el nombre.
 */
export function nombreItem(service: Service, variante?: string): string {
  const ref =
    service.referencia && !sinTildes(service.name).includes(sinTildes(service.referencia))
      ? ` Ref ${service.referencia}`
      : "";
  // T-123: con varios detalles la combinación ya viene con sus nombres
  // ("Talla 30, Color Blanco"); con uno solo se le antepone ("Talla 30").
  const opcion = variante ? ` · ${etiquetaVariante(service, variante)}` : "";
  return `${service.name}${ref}${opcion}`;
}

/**
 * T-104: la opción del catálogo que corresponde a lo que dijo el cliente (o
 * la IA): "30", "talla 30", "Talla: 30" → "30"; "m" → "M". Solo devuelve una
 * opción que EXISTE: una talla que el negocio no tiene no se anota.
 */
export function elegirVariante(service: Service, texto: string): string | undefined {
  // T-123: la lectura vive en `detalles.ts`, que también entiende varios
  // detalles a la vez ("30 blanco" → "Talla 30, Color Blanco").
  return leerDetalles(service, texto).variante;
}

/** T-104: la primera línea de un producto con opciones a la que todavía le falta elegir cuál. */
export function faltaVariante(
  items: CartItem[],
  services: Service[],
): { item: CartItem; service: Service } | undefined {
  for (const item of items) {
    const service = services.find((s) => s.id === item.serviceId);
    if (service && detallesDe(service).length > 0 && item.variante === undefined) return { item, service };
  }
  return undefined;
}

/**
 * Total del carrito (precio × cantidad, sumado). Una línea cuyo `Service` ya
 * no existe (se borró del catálogo entre medio) se ignora en vez de romper el
 * cálculo — no debería pasar en un pedido en curso, pero un total mal es peor
 * que uno incompleto.
 */
export function totalCarrito(items: CartItem[], services: Service[]): number {
  return items.reduce((total, item) => {
    const service = services.find((s) => s.id === item.serviceId);
    return service ? total + service.price * item.cantidad : total;
  }, 0);
}

/**
 * Detalle del carrito, una línea por producto ("2x Harina 1 Kg — $10.000") y
 * el total al final. Es lo que el motor antepone al pedir/confirmar el
 * pedido, y lo que resume `notifyOwner` para la dueña.
 */
export function resumenCarrito(
  items: CartItem[],
  services: Service[],
  config: BusinessConfig,
  /** T-52: con una entrega a domicilio cobrada, el resumen suma esa línea y el total la incluye. */
  entrega?: string,
): string {
  const lineas = items
    .map((item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (!service) return null;
      // T-105: la nota va entre paréntesis en la misma línea, para que la
      // dueña la vea junto al producto que tiene que preparar distinto.
      const nota = item.nota ? ` (${item.nota})` : "";
      return `${item.cantidad}x ${nombreItem(service, item.variante)}${nota} — ${formatPrice(config, service.price * item.cantidad)}`;
    })
    .filter((l): l is string => l !== null);
  const domicilio = costoEntrega(config, entrega);
  if (domicilio > 0) lineas.push(`Domicilio — ${formatPrice(config, domicilio)}`);
  const total = totalPedido(items, services, config, entrega);
  return [...lineas, `Total: ${formatPrice(config, total)}`].join("\n");
}

/** T-52: cuánto se cobra por la entrega elegida (0 si no es a domicilio o el negocio no lo cobra). */
export function costoEntrega(config: BusinessConfig, entrega: string | undefined): number {
  return esDomicilio(entrega) ? (config.pedidos?.costoDomicilio ?? 0) : 0;
}

/**
 * T-52: el total que paga el cliente — carrito más el domicilio si
 * corresponde. Es el que se guarda en el pedido y contra el que se comparan
 * el comprobante y el pago de Wompi, así que todos lo calculan acá.
 */
export function totalPedido(
  items: CartItem[],
  services: Service[],
  config: BusinessConfig,
  entrega: string | undefined,
): number {
  return totalCarrito(items, services) + costoEntrega(config, entrega);
}

/**
 * T-36: ¿la modalidad elegida es una entrega a domicilio? Las opciones las
 * escribe cada negocio ("Domicilio", "Envío a casa", "Delivery"…), así que se
 * reconoce por palabras y no por un valor fijo. Solo a domicilio hace falta
 * pedir una dirección.
 */
export function esDomicilio(modalidad: string | undefined): boolean {
  if (!modalidad) return false;
  return /domicilio|env[ií]o|delivery|a (mi |tu |la )?casa|llev[ae]n|despacho/i.test(modalidad);
}

/**
 * T-36: lo mínimo para que una dirección sirva — al menos 5 caracteres y
 * algún número o palabra de calle. Un "sí" o "ok" en la etapa de dirección
 * no se puede guardar como si fuera una.
 */
export function pareceDireccion(texto: string): boolean {
  const t = texto.trim();
  if (t.length < 5 || t.length > 200) return false;
  return /\d/.test(t) || /\b(calle|carrera|cra|cl|av|avenida|diagonal|transversal|barrio|conjunto|torre|apto|casa|manzana|mz|edificio)\b/i.test(t);
}

/** Líneas de modalidad y dirección para mostrarle al cliente o a la dueña. */
export function lineasEntrega(entrega: string | undefined, direccion: string | undefined): string {
  return [entrega ? `Entrega: ${entrega}` : null, direccion ? `Dirección: ${direccion}` : null]
    .filter((l): l is string => l !== null)
    .join("\n");
}
