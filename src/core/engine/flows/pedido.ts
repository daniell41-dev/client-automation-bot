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
