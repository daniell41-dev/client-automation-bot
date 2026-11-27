/**
 * T-152: la lista de opciones que ve el cliente cuando el asistente le ofrece
 * varios productos. La arma el código y no la IA, igual que el resumen del
 * pedido: el precio sale del catálogo (nunca de lo que la IA "recuerda") y
 * el formato es siempre el mismo, una línea por producto.
 *
 * En la prueba real con los 116 jeans, la IA escribió un párrafo de cinco
 * líneas repitiendo "Skinny dama jean stretch tiro alto…" en cada opción.
 * `nombreCorto` quita lo que se repite en casi todo el catálogo y deja lo que
 * distingue a cada producto.
 */

import { foldAccents } from "@/core/engine/text-normalize";
import type { BusinessConfig, Service } from "@/core/types";
import { formatoPrecio } from "@/core/moneda";

/** Con menos productos, "lo que se repite" no dice nada: se deja el nombre entero. */
const MIN_PRODUCTOS = 10;
/** Una palabra que está en el 80 % de los nombres no distingue a ninguno. */
const UMBRAL = 0.8;

const palabras = (nombre: string) => nombre.split(/\s+/).filter(Boolean);
const clave = (p: string) => foldAccents(p).toLowerCase();

/**
 * El nombre sin las palabras de relleno del catálogo. Una palabra frecuente
 * se conserva solo si casi siempre va con otra y aquí no: en un catálogo de
 * "tiro alto", el "tiro medio" se queda entero porque es justo lo que lo
 * distingue.
 */
export function nombreCorto(service: Service, catalogo: Service[]): string {
  if (catalogo.length < MIN_PRODUCTOS) return service.name;
  const total = catalogo.length;
  const freq = new Map<string, number>();
  const freqPar = new Map<string, number>();
  for (const s of catalogo) {
    const ps = palabras(s.name).map(clave);
    for (const p of new Set(ps)) freq.set(p, (freq.get(p) ?? 0) + 1);
    for (const par of new Set(ps.slice(1).map((p, i) => `${ps[i]} ${p}`))) freqPar.set(par, (freqPar.get(par) ?? 0) + 1);
  }
  const comun = (n: number | undefined) => (n ?? 0) / total >= UMBRAL;
  // Las palabras que casi siempre van seguidas de la misma ("tiro" → "alto").
  const pareja = new Map<string, string>();
  for (const [par, n] of freqPar) if (comun(n)) pareja.set(par.split(" ")[0], par.split(" ")[1]);

  const ps = palabras(service.name);
  const corto = ps
    .filter((p, i) => {
      const k = clave(p);
      if (!comun(freq.get(k))) return true;
      const siguiente = ps[i + 1] ? clave(ps[i + 1]) : undefined;
      return pareja.has(k) && siguiente !== undefined && pareja.get(k) !== siguiente;
    })
    .join(" ");
  return corto || service.name;
}

function formatPrice(config: BusinessConfig, price: number): string {
  return formatoPrecio(price, config.currency, config.locale);
}

/** "1. B1167 · Skinny 2 pinzas moldeador azul claro · $ 129.900", una línea por producto. */
export function listaDeProductos(productos: Service[], config: BusinessConfig): string {
  return productos
    .map((s, i) =>
      [`${i + 1}. ${s.referencia ? `${s.referencia} · ` : ""}${nombreCorto(s, config.services)}`, formatPrice(config, s.price)].join(
        " · ",
      ),
    )
    .join("\n");
}

/** Cuántas opciones van en una lista: más de 8 por WhatsApp ya no se leen. */
export const MAX_EN_LISTA = 8;

/**
 * "Lo que manejamos: Skinny, Short, Bota Campana y Overol." Va cuando el
 * cliente pidió algo que no está (en la prueba real, "chaquetas"): en vez de
 * empujarle un jean cualquiera, se le muestra qué hay para que elija.
 */
export function lineaCategorias(categorias: { nombre: string }[], max = MAX_EN_LISTA): string {
  const nombres = categorias.slice(0, max).map((c) => c.nombre);
  if (nombres.length === 0) return "";
  const texto = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
  return `Lo que manejamos: ${texto}.`;
}

/** Cuántas de las categorías ya nombró la IA en su texto (si ya las dijo, no se repiten). */
export function categoriasNombradas(texto: string, categorias: { nombre: string }[]): number {
  const t = clave(texto);
  return categorias.filter((c) => t.includes(clave(c.nombre))).length;
}
