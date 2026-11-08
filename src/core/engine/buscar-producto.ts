/**
 * Búsqueda de producto por lo que describió una imagen (T-23.4).
 *
 * Función PURA, sin IA ni I/O: cruza el `ImageDescription` que devolvió el
 * modelo con visión (lo que VE, ver `core/ai/image-schema.ts`) contra el
 * catálogo real del negocio. El modelo nunca decide el match — es justamente
 * lo que evita que alucine un producto que no existe en el inventario real.
 *
 * Prioridad (la primera que encuentra candidatos gana, no se acumulan):
 *   1. Una keyword/referencia del servicio aparece en el texto visible de la
 *      foto (etiqueta, código de barras, empaque) → el match más confiable.
 *   2. Marca + tipo de producto coinciden con el nombre/descripción/keywords.
 *   3. Solo la categoría coincide → hasta 3 candidatos (ambiguo a propósito).
 *   4. Nada coincide → `[]` (T-23.5 le pide al cliente que mande el nombre).
 */

import type { Service } from "@/core/types";
import type { ImageDescription } from "@/core/ai/image-schema";
import { foldAccents } from "@/core/engine/text-normalize";
import { availableServices } from "@/core/engine/intake";

const MAX_CANDIDATOS_POR_CATEGORIA = 3;

function fold(text: string): string {
  return foldAccents(text).trim();
}

/** ¿Alguna keyword del servicio aparece en algún texto visible de la foto (o viceversa)? */
function coincidePorReferencia(service: Service, textosVisibles: string[]): boolean {
  const keywords = (service.keywords ?? []).map(fold).filter(Boolean);
  if (keywords.length === 0 || textosVisibles.length === 0) return false;
  return textosVisibles.some((texto) =>
    keywords.some((keyword) => texto === keyword || texto.includes(keyword) || keyword.includes(texto)),
  );
}

/** No hay campo `marca` en `Service`: se busca en nombre/descripción/keywords, igual que el tipo en categoría. */
function coincidePorMarcaYTipo(service: Service, marca: string, tipo: string): boolean {
  const textoLibre = fold(
    [service.name, service.description, ...(service.keywords ?? [])].join(" "),
  );
  const textoTipo = fold([service.name, service.description, service.categoria ?? ""].join(" "));
  return textoLibre.includes(marca) && textoTipo.includes(tipo);
}

function coincidePorCategoria(service: Service, categoria: string): boolean {
  return !!service.categoria && fold(service.categoria).includes(categoria);
}

/**
 * Devuelve los candidatos del catálogo que corresponden a la descripción de
 * la foto, o `[]` si no hay ninguno. Nunca incluye un ítem con
 * `disponible === false` (mismo filtro que el resto del motor, ver
 * `availableServices`).
 */
export function buscarProducto(descripcion: ImageDescription, catalogo: Service[]): Service[] {
  const disponibles = availableServices(catalogo);
  const textosVisibles = descripcion.textoVisible.map(fold).filter(Boolean);

  const porReferencia = disponibles.filter((s) => coincidePorReferencia(s, textosVisibles));
  if (porReferencia.length > 0) return porReferencia;

  if (descripcion.marca) {
    const marca = fold(descripcion.marca);
    const tipo = fold(descripcion.tipoProducto);
    const porMarcaYTipo = disponibles.filter((s) => coincidePorMarcaYTipo(s, marca, tipo));
    if (porMarcaYTipo.length > 0) return porMarcaYTipo;
  }

  if (descripcion.categoria) {
    const categoria = fold(descripcion.categoria);
    const porCategoria = disponibles.filter((s) => coincidePorCategoria(s, categoria));
    if (porCategoria.length > 0) return porCategoria.slice(0, MAX_CANDIDATOS_POR_CATEGORIA);
  }

  return [];
}
