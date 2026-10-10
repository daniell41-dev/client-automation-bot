/**
 * Flujo de pedido (T-21): carrito de uno o más productos con cantidad y
 * total. Es lo que reemplaza a "fecha + confirmar" cuando el ítem elegido no
 * es una cita (ver `modoDelItem`). Funciones puras — `responder.ts` es quien
 * las usa para decidir la respuesta y actualizar el lead.
 */

import type { BusinessConfig, CartItem, Service } from "@/core/types";

/**
 * Formatea un precio según la moneda/locale del negocio. Duplicado a
 * propósito (mismo criterio que `responder.ts` y `ai/agent-prompt.ts`):
 * importar el de `responder.ts` acá crearía un ciclo, porque `responder.ts`
 * es quien importa este módulo.
 */
function formatPrice(config: BusinessConfig, price: number): string {
  try {
    return new Intl.NumberFormat(config.locale ?? "es-CO", {
      style: "currency",
      currency: config.currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price} ${config.currency}`;
  }
}

/**
 * Agrega `cantidad` unidades de `serviceId` al carrito. Si el producto ya
 * estaba cargado, SUMA la cantidad en la misma línea en vez de duplicarla:
 * "2 harinas" y después "una más" terminan en una sola fila con 3.
 */
export function agregarAlCarrito(
  items: CartItem[] | undefined,
  serviceId: string,
  cantidad: number,
): CartItem[] {
  const actuales = items ?? [];
  const existente = actuales.find((i) => i.serviceId === serviceId);
  if (existente) {
    return actuales.map((i) =>
      i.serviceId === serviceId ? { ...i, cantidad: i.cantidad + cantidad } : i,
    );
  }
  return [...actuales, { serviceId, cantidad }];
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
): string {
  const lineas = items
    .map((item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (!service) return null;
      return `${item.cantidad}x ${service.name} — ${formatPrice(config, service.price * item.cantidad)}`;
    })
    .filter((l): l is string => l !== null);
  const total = totalCarrito(items, services);
  return [...lineas, `Total: ${formatPrice(config, total)}`].join("\n");
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
