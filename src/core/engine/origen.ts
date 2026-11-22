/**
 * T-120: de qué anuncio o publicación viene un cliente.
 *
 * El canal trae el dato (en WhatsApp, el `referral` del Click-to-WhatsApp) y
 * acá se decide qué hacer con él: guardarlo en el lead una sola vez, cómo
 * mostrárselo a la dueña y cómo contar clientes por anuncio en el portal.
 */

import type { Lead, OrigenContacto } from "@/core/types";

/**
 * Tope de largo de los textos del anuncio. El cuerpo de un anuncio puede ser
 * largo y termina en el prompt de la IA y en el aviso de WhatsApp a la dueña:
 * con el título alcanza para reconocerlo, el resto es ruido (y tokens).
 */
const MAX_TEXTO = 200;
const MAX_URL = 500;

function textoCorto(valor: unknown, max: number): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpio = valor.replace(/\s+/g, " ").trim();
  if (!limpio) return undefined;
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

/**
 * Lee un origen de algo que no se sabe si tiene la forma correcta: la
 * columna `jsonb` de la base o un payload de Meta ya traducido. Devuelve
 * `undefined` antes que un objeto a medias — un origen raro nunca debe
 * tumbar la carga del lead ni el mensaje.
 */
export function leerOrigen(raw: unknown): OrigenContacto | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (o.tipo !== "anuncio" && o.tipo !== "publicacion") return undefined;
  const origen: OrigenContacto = { tipo: o.tipo };
  const id = textoCorto(o.id, 100);
  const titulo = textoCorto(o.titulo, MAX_TEXTO);
  const texto = textoCorto(o.texto, MAX_TEXTO);
  const url = textoCorto(o.url, MAX_URL);
  if (id) origen.id = id;
  if (titulo) origen.titulo = titulo;
  if (texto) origen.texto = texto;
  if (url) origen.url = url;
  return origen;
}

/**
 * Guarda el origen en el lead solo si todavía no tenía uno. El `referral`
 * viene en el mensaje que abrió el chat desde el anuncio; si después el
 * cliente toca OTRO anuncio, el que lo trajo sigue siendo el primero — es el
 * que la dueña quiere medir.
 */
export function registrarOrigen(lead: Lead, origen: OrigenContacto | undefined): void {
  if (lead.origen || !origen) return;
  lead.origen = origen;
}

/** "anuncio «Jeans clásicos desde $35.000»" — para el aviso y el panel. */
export function describirOrigen(origen: OrigenContacto): string {
  const tipo = origen.tipo === "anuncio" ? "anuncio" : "publicación";
  // Sin título se usa el texto del anuncio: es lo que la dueña escribió y lo
  // reconoce. Sin ninguno de los dos, al menos se sabe que vino de uno.
  const nombre = origen.titulo ?? origen.texto;
  return nombre ? `${tipo} «${nombre}»` : `un ${tipo} de Meta`;
}

/** Fila del conteo "clientes por anuncio" del portal. */
export interface ConteoOrigen {
  /** Única por anuncio: dos anuncios con el mismo título tienen etiquetas iguales. */
  clave: string;
  etiqueta: string;
  clientes: number;
}

/**
 * Cuántos clientes trajo cada anuncio, de más a menos. Se agrupa por `id`
 * del anuncio cuando viene (dos anuncios pueden llamarse igual) y si no por
 * su descripción. Recibe la columna cruda de la base, así que valida cada
 * fila con `leerOrigen` y salta las que no tienen origen.
 */
export function contarPorOrigen(origenes: unknown[]): ConteoOrigen[] {
  const grupos = new Map<string, ConteoOrigen>();
  for (const raw of origenes) {
    const origen = leerOrigen(raw);
    if (!origen) continue;
    const etiqueta = describirOrigen(origen);
    const clave = origen.id ? `${origen.tipo}:${origen.id}` : etiqueta;
    const grupo = grupos.get(clave);
    if (grupo) grupo.clientes += 1;
    else grupos.set(clave, { clave, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1), clientes: 1 });
  }
  return [...grupos.values()].sort((a, b) => b.clientes - a.clientes || a.etiqueta.localeCompare(b.etiqueta));
}
