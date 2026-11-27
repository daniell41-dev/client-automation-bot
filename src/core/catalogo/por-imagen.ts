/**
 * T-156: qué productos del catálogo corresponden a la foto que mandó el
 * cliente. El caso de los mayoristas: el cliente recibe el catálogo en PDF,
 * le toma captura a un pantalón y pregunta "¿tienes este?".
 *
 * Orden, del más seguro al menos:
 *   1. La captura muestra la REFERENCIA ("REF 1167", "B203"): es exacto.
 *   2. Lo de antes (T-23.4): palabra clave del empaque, o marca + tipo.
 *   3. Solo en catálogos con referencias: parecidos por cómo se ve
 *      (corte, color, lo que se lee del nombre). Se OFRECEN, nunca se
 *      afirman: una B1167 y una B1168 se ven iguales y difieren en una pinza,
 *      y anotar el jean equivocado en un pedido mayorista sale caro.
 *   4. Lo de antes: solo la categoría.
 *
 * Los catálogos sin referencias (repuestos, farmacia) no pasan por el paso 3:
 * siguen respondiendo exactamente como antes.
 *
 * La IA solo describe la foto (`describeImage`); el cruce con el catálogo es
 * código, sin IA: así el costo por foto no depende del tamaño del catálogo.
 */

import type { ImageDescription } from "@/core/ai/image-schema";
import { buscarProductos, esReferencia, refNormal } from "@/core/catalogo/buscar";
import { MAX_EN_LISTA } from "@/core/catalogo/lista";
import { buscarProducto } from "@/core/engine/buscar-producto";
import { availableServices } from "@/core/engine/intake";
import { foldAccents } from "@/core/engine/text-normalize";
import type { Service } from "@/core/types";

export type ResultadoImagen =
  | { tipo: "referencia"; productos: Service[] }
  /** Coincidencia como antes de T-156 (palabra clave, marca o categoría): se responde igual que antes. */
  | { tipo: "legado"; productos: Service[] }
  | { tipo: "parecidos"; productos: Service[] }
  | { tipo: "ninguno" };

/** Más de 5 "parecidos" ya no ayudan a elegir. */
export const MAX_PARECIDOS = 5;

/**
 * Lo que en una captura parece número pero no es referencia: precios
 * ("$129.900" tiene un "900", y existe la B900), fechas, la hora y la batería
 * del teléfono. Sin esto, la captura de la B1167 respondía "es la B900".
 */
const NO_REFERENCIAS = [
  /(?:\$|\bbs\.?|\bcop\b|\busd\b|\bves\b)\s*\d[\d.,]*/gi,
  /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b/g,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  /\b\d{1,2}:\d{2}\b/g,
  /\b\d{1,3}\s*%/g,
];

export function limpiarTextoVisible(textos: string[]): string[] {
  return textos
    .map((t) => NO_REFERENCIAS.reduce((acc, r) => acc.replace(r, " "), t).replace(/\s+/g, " ").trim())
    .filter((t) => /[a-z0-9]/i.test(t));
}

/** Las referencias del catálogo que aparecen en el texto ("REF 1167", "B 203", "b-203"). */
function porReferencia(textos: string[], disponibles: Service[]): Service[] {
  const tokens = textos.flatMap((t) => foldAccents(t).toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean);
  const candidatos = new Set(tokens);
  // "B 203" o "B-203": letra y número separados.
  tokens.forEach((t, i) => {
    if (/^[a-z]{1,3}$/.test(t) && /^\d+$/.test(tokens[i + 1] ?? "")) candidatos.add(t + tokens[i + 1]);
  });
  return disponibles.filter((s) => {
    if (!s.referencia) return false;
    const ref = refNormal(s.referencia);
    return [...candidatos].some((t) => esReferencia(t, ref));
  });
}

export function productosDeImagen(descripcion: ImageDescription, catalogo: Service[]): ResultadoImagen {
  const disponibles = availableServices(catalogo);
  const textos = limpiarTextoVisible(descripcion.textoVisible);

  const conReferencia = porReferencia(textos, disponibles);
  if (conReferencia.length > 0) return { tipo: "referencia", productos: conReferencia.slice(0, MAX_EN_LISTA) };

  const fuertes = buscarProducto({ ...descripcion, textoVisible: textos, categoria: undefined }, catalogo);
  if (fuertes.length > 0) return { tipo: "legado", productos: fuertes };

  if (disponibles.some((s) => s.referencia)) {
    const consulta = [...(descripcion.atributos ?? []), descripcion.tipoProducto, descripcion.categoria ?? "", ...textos].join(" ");
    const busqueda = buscarProductos(disponibles, { mensaje: consulta, minRelativo: 0.6 });
    if (!busqueda.sinResultados && busqueda.productos.length > 0) {
      return { tipo: "parecidos", productos: busqueda.productos.slice(0, MAX_PARECIDOS) };
    }
  }

  const porCategoria = buscarProducto({ ...descripcion, textoVisible: [], marca: undefined }, catalogo);
  if (porCategoria.length > 0) return { tipo: "legado", productos: porCategoria };
  return { tipo: "ninguno" };
}
