/**
 * T-110: la referencia y los detalles (tallas, colores…) son cosa de un
 * mayorista de ropa, no de un restaurante. Mostrárselos a la dueña de un
 * corrientazo solo le agrega campos que no entiende, así que el rubro decide
 * (`catalogo.campos`) y la dueña puede encenderlos en Configuración (una
 * heladería con sabores, un "término de la carne").
 *
 * Sin declarar = oculto, al revés que Duración (T-21): estos campos son
 * nuevos y ningún negocio viejo los usaba de verdad. Pero si un producto YA
 * tiene referencia o detalles guardados, se muestran igual: esconder el campo
 * dejaría un dato que el bot usa sin forma de verlo ni de borrarlo.
 */

import { detallesDe } from "@/core/engine/detalles";
import type { CatalogoConfig, Service } from "@/core/types";

export function mostrarReferencia(catalogo: CatalogoConfig | undefined, service: Service): boolean {
  return catalogo?.campos?.referencia === true || (service.referencia ?? "").trim() !== "";
}

export function mostrarDetalles(catalogo: CatalogoConfig | undefined, service: Service): boolean {
  return catalogo?.campos?.detalles === true || detallesDe(service).length > 0;
}
