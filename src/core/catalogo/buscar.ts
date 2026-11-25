/**
 * T-118: buscador de productos ANTES de la IA, para catálogos grandes.
 *
 * Hasta ahora cada mensaje le mandaba a la IA el catálogo completo. Con los
 * 116 jeans del primer mayorista eran ~23.000 tokens por mensaje (6 veces un
 * negocio chico): más caro, más lento, y el proveedor limita tokens por
 * minuto entre TODOS los negocios. Aquí el código busca en el catálogo lo que
 * el cliente pidió y la IA ve solo eso (~4.000 tokens, tenga el negocio 116 o
 * 5.000 productos). Recorrer el catálogo en memoria cuesta microsegundos y no
 * toca la base.
 *
 * Criterio: la IA nunca debe quedarse sin el producto del que se habla. Por
 * eso, además de lo que coincide con el mensaje, siempre van los productos del
 * carrito y los que el asistente acaba de mostrar ("el 2", "ese mismo").
 *
 * Puro y sin dependencias: se prueba con catálogos inventados y con el real.
 */

import { foldAccents } from "@/core/engine/text-normalize";
import type { Service } from "@/core/types";

/** Con menos productos que esto se sigue mandando el catálogo completo: ahí funciona bien y no vale la pena arriesgar una búsqueda. */
export const UMBRAL_CATALOGO_GRANDE = 40;

/** Cuántos productos ve la IA como máximo por mensaje (además del carrito y lo recién mostrado). */
export const MAX_RESULTADOS = 12;

/** Palabras que no dicen qué producto se busca. Lo genérico del rubro ("jean", "dama") lo baja solo el peso por rareza. */
const VACIAS = new Set(
  (
    "hola buenas buenos dias tardes noches gracias por favor porfa quiero quisiera queria necesito busco buscando " +
    "tiene tienen tienes hay manejan venden me mandas mandame mande mandeme envie enviame regalame dame deme " +
    "de del la el los las un una unos unas en y o u a al con sin para que cual cuales como cuanto cuanta vale valen " +
    "precio precios cuesta cuestan es son esta estan este ese esa eso esto ya si no mas otro otra otros otras " +
    "talla tallas color colores ref referencia modelo modelos producto productos algo tambien muy mi su sus lo le les"
  ).split(" "),
);

const normalizar = (t: string) => foldAccents(t).toLowerCase();

/** Palabras con sentido de un texto, en singular aproximado ("shorts" → "short", "colores" queda vacía). */
function terminos(texto: string): string[] {
  return (normalizar(texto).match(/[a-z0-9ñ]+/g) ?? [])
    .filter((p) => !VACIAS.has(p) && (p.length > 1 || /\d/.test(p)))
    .map(singular);
}

function singular(p: string): string {
  if (p.length > 4 && p.endsWith("es") && !/[aeiou]es$/.test(p.slice(-3))) return p.slice(0, -2);
  if (p.length > 3 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

const refNormal = (r: string) => normalizar(r).replace(/[^a-z0-9]/g, "");

export interface ConsultaCatalogo {
  /** El mensaje que el cliente acaba de mandar. */
  mensaje: string;
  /** Los últimos mensajes del cliente (el más reciente al final), para "¿y en negro?". */
  anterioresCliente?: string[];
  /** Los últimos mensajes del asistente: lo que ahí se mostró sigue a la vista. */
  anterioresAsistente?: string[];
  /** Ids de los productos que ya están en el carrito. */
  enCarrito?: string[];
}

export interface ResultadoBusqueda {
  /** Lo que ve la IA: carrito + recién mostrados + lo que coincide, sin repetir. */
  productos: Service[];
  /** "Skinny" → 38: para que la IA pueda orientar al cliente sin ver todo. */
  categorias: { nombre: string; cantidad: number }[];
  /** El cliente pidió algo concreto y nada coincidió (para no decir "no tenemos" a ciegas y para registrarlo). */
  sinResultados: boolean;
  /** Lo que se buscó, para el registro de búsquedas fallidas. */
  buscado: string[];
}

/** El texto de cada producto donde se busca, con más peso en nombre, categoría y referencia que en la descripción. */
function camposDe(s: Service) {
  const opciones = (s.detalles ?? (s.variantes ? [s.variantes] : [])).flatMap((d) => d.opciones);
  return {
    fuerte: new Set(terminos(`${s.name} ${s.categoria ?? ""}`)),
    debil: new Set(terminos(s.description)),
    opciones: new Set(opciones.map((o) => singular(normalizar(o)))),
    ref: s.referencia ? refNormal(s.referencia) : "",
  };
}

/** ¿Este término nombra una referencia? "b203" exacto, o "203" con 3 cifras o más para "B203". */
function esReferencia(termino: string, ref: string): boolean {
  if (!ref) return false;
  if (termino === ref) return true;
  return /^\d{3,}$/.test(termino) && ref.replace(/\D/g, "") === termino;
}

export function buscarProductos(catalogo: Service[], consulta: ConsultaCatalogo): ResultadoBusqueda {
  const indexados = catalogo.map((s) => ({ s, c: camposDe(s) }));

  // Peso por rareza: "jean" está en los 116 y no ayuda a elegir; "torero" sí.
  const df = new Map<string, number>();
  for (const { c } of indexados) for (const t of new Set([...c.fuerte, ...c.debil])) df.set(t, (df.get(t) ?? 0) + 1);
  const rareza = (t: string) => Math.log((catalogo.length + 1) / ((df.get(t) ?? 0) + 0.5));
  // Una palabra que está en más de la mitad del catálogo ("jean" en una
  // tienda de jeans) no elige nada: "¿qué jeans tienen?" es una pregunta
  // general, y se responde con las categorías, no con 12 jeans al azar.
  const generica = (t: string) => (df.get(t) ?? 0) > catalogo.length / 2;
  const utiles = (texto: string) => terminos(texto).filter((t) => !generica(t));

  const actuales = utiles(consulta.mensaje);
  // El mensaje anterior del cliente pesa la mitad: "skinny" … "¿y en azul claro?".
  const previos = (consulta.anterioresCliente ?? []).slice(-1).flatMap(utiles);

  const puntaje = (c: ReturnType<typeof camposDe>, lista: string[]) => {
    let p = 0;
    for (const t of lista) {
      if (esReferencia(t, c.ref)) p += 100;
      else if (c.fuerte.has(t)) p += 3 * rareza(t);
      else if (c.debil.has(t)) p += rareza(t);
    }
    return p;
  };

  const puntuados = indexados
    .map(({ s, c }) => ({ s, p: puntaje(c, actuales) + 0.5 * puntaje(c, previos) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p);

  // Si hubo una referencia exacta, el cliente sabe lo que quiere: no se le mezclan parecidos.
  const conReferencia = puntuados.filter((x) => x.p >= 100);
  const coincidencias = (conReferencia.length ? conReferencia : puntuados).slice(0, MAX_RESULTADOS).map((x) => x.s);

  // Lo recién mostrado por el asistente (por referencia o nombre exacto) y el carrito, siempre a la vista.
  const textoAsistente = normalizar((consulta.anterioresAsistente ?? []).slice(-2).join("\n"));
  const refsAsistente = new Set((textoAsistente.match(/[a-z0-9]+/g) ?? []).map((t) => t));
  const mostrados = indexados
    .filter(({ s, c }) => (c.ref.length >= 3 && refsAsistente.has(c.ref)) || textoAsistente.includes(normalizar(s.name)))
    .map(({ s }) => s);
  const carrito = catalogo.filter((s) => consulta.enCarrito?.includes(s.id));

  const vistos = new Set<string>();
  const productos = [...carrito, ...mostrados, ...coincidencias].filter((s) => !vistos.has(s.id) && vistos.add(s.id));

  const conteo = new Map<string, number>();
  for (const s of catalogo) if (s.categoria) conteo.set(s.categoria, (conteo.get(s.categoria) ?? 0) + 1);
  const categorias = [...conteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));

  // "Algo concreto" = un término que no es solo una opción común (una talla
  // "10" está en todos los productos y no busca nada por sí sola).
  const opcionesComunes = new Set(indexados.flatMap(({ c }) => [...c.opciones]));
  const concretos = actuales.filter((t) => !opcionesComunes.has(t));
  return {
    productos,
    categorias,
    sinResultados: concretos.length > 0 && coincidencias.length === 0,
    buscado: concretos,
  };
}

/** Descripciones de marketing de 300 caracteres no ayudan a vender por WhatsApp; recortadas ahorran tokens. */
export function recortarDescripcion(texto: string, max = 120): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}
