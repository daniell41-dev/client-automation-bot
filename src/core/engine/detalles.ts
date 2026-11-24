/**
 * T-123: detalles de un producto (talla, color, estilo…), varios a la vez.
 *
 * T-104 dejaba UNA sola lista de opciones por producto ("Talla": 28, 30…).
 * Un jean viene en talla Y en color, así que ahora un producto puede tener
 * hasta 3 detalles. Cada línea del carrito sigue guardando un solo texto en
 * `CartItem.variante`: con un detalle es la opción tal cual ("30", como
 * antes) y con varios es la combinación ("Talla 30, Color Blanco"). Así el
 * resto del motor (líneas separadas, resumen, aviso, panel) no cambia.
 */

import type { Service, VariantesItem } from "@/core/types";

const doblar = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Los detalles del producto. Un producto guardado antes de T-123 tiene
 * `variantes` (una lista) y se lee como un solo detalle: no hay que migrar
 * nada en la base.
 */
export function detallesDe(service: Service): VariantesItem[] {
  if (service.detalles?.length) return service.detalles.filter((d) => d.opciones.length > 0);
  return service.variantes?.opciones.length ? [service.variantes] : [];
}

/** Lo que se pudo leer de la respuesta del cliente (o de la IA) para un producto. */
export interface LecturaDetalles {
  /** La combinación completa, lista para el carrito. Solo si están TODOS los detalles. */
  variante?: string;
  /** Detalles que se reconocieron, con la opción del catálogo (no la que escribió el cliente). */
  encontrados: { nombre: string; opcion: string }[];
  /** Detalles que faltan o cuya opción no existe en el catálogo. */
  faltan: VariantesItem[];
}

/**
 * Busca en el texto una opción de cada detalle. Solo acepta opciones que
 * EXISTEN: una talla que el negocio no tiene no se anota ni se cambia por la
 * más parecida (misma regla que T-104).
 *
 * Con un solo detalle se mantiene la lectura de T-104 (el texto ES la opción,
 * con o sin "Talla:" adelante), para no cambiar cómo se comporta un producto
 * que ya funcionaba. Con varios, cada opción se busca como palabra completa:
 * "30" no debe calzar dentro de "300".
 */
export function leerDetalles(service: Service, texto: string): LecturaDetalles {
  const detalles = detallesDe(service);
  if (detalles.length === 0) return { encontrados: [], faltan: [] };

  if (detalles.length === 1) {
    const [d] = detalles;
    const limpio = doblar(texto).replace(new RegExp(`^${escapar(doblar(d.nombre))}\\s*:?\\s*`), "");
    const opcion = limpio ? d.opciones.find((o) => doblar(o) === limpio) : undefined;
    return opcion
      ? { variante: opcion, encontrados: [{ nombre: d.nombre, opcion }], faltan: [] }
      : { encontrados: [], faltan: [d] };
  }

  const t = doblar(texto);
  const encontrados: LecturaDetalles["encontrados"] = [];
  const faltan: VariantesItem[] = [];
  for (const d of detalles) {
    // Las más largas primero: entre "XL" y "L", "XL" gana si está.
    const opcion = [...d.opciones]
      .sort((a, b) => b.length - a.length)
      .find((o) => new RegExp(`(^|[^a-z0-9])${escapar(doblar(o))}([^a-z0-9]|$)`).test(t));
    if (opcion) encontrados.push({ nombre: d.nombre, opcion });
    else faltan.push(d);
  }
  return {
    ...(faltan.length === 0 && { variante: encontrados.map((e) => `${e.nombre} ${e.opcion}`).join(", ") }),
    encontrados,
    faltan,
  };
}

/** "Talla: 30, 32 · Color: Blanco, Azul" — las opciones reales, armadas por el motor. */
function listaOpciones(detalles: VariantesItem[]): string {
  return detalles.map((d) => `${d.nombre}: ${d.opciones.join(", ")}`).join(" · ");
}

/** "talla y color", "talla, color y estilo". */
function nombresDetalles(detalles: VariantesItem[]): string {
  const nombres = detalles.map((d) => d.nombre.toLowerCase());
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : nombres[0];
}

/**
 * La pregunta cuando a una línea del carrito le faltan los detalles. Con un
 * solo detalle se conserva el texto de T-104 tal cual.
 */
export function preguntaDetalles(service: Service, nombreProducto: string): string {
  const detalles = detallesDe(service);
  if (detalles.length === 1) {
    const d = detalles[0];
    return `¿En qué ${d.nombre.toLowerCase()} quiere el ${nombreProducto}? Tenemos: ${d.opciones.join(", ")}. Si quiere varias, dígame cuántas de cada una 🙌`;
  }
  return `¿Qué ${nombresDetalles(detalles)} quiere el ${nombreProducto}? Tenemos ${listaOpciones(detalles)}. Si quiere varias combinaciones, dígame cuántas de cada una 🙌`;
}

/**
 * Qué contestar cuando la opción que llegó no sirve. Si el cliente dijo
 * parte (la talla pero no el color), se le pide SOLO lo que falta: volver a
 * preguntar todo haría parecer que el bot no lo escuchó.
 */
export function respuestaDetalleInvalido(service: Service, texto: string, nombreProducto: string): string {
  const detalles = detallesDe(service);
  if (detalles.length === 1) {
    return `No tenemos esa ${detalles[0].nombre.toLowerCase()} en el ${nombreProducto}. ${preguntaDetalles(service, nombreProducto)}`;
  }
  const { encontrados, faltan } = leerDetalles(service, texto);
  if (encontrados.length > 0) {
    const elegido = encontrados.map((e) => `${e.nombre} ${e.opcion}`).join(", ");
    return `Para el ${nombreProducto} (${elegido}), ¿qué ${nombresDetalles(faltan)} quiere? Tenemos ${listaOpciones(faltan)}.`;
  }
  return `No tenemos esa opción en el ${nombreProducto}. ${preguntaDetalles(service, nombreProducto)}`;
}

/** Cómo se lee la combinación en el resumen: con un detalle "Talla 30"; con varios, ya viene armada. */
export function etiquetaVariante(service: Service, variante: string): string {
  const detalles = detallesDe(service);
  return detalles.length > 1 ? variante : `${detalles[0]?.nombre ?? "Opción"} ${variante}`;
}

/** Para el prompt de la IA: "Talla (opciones): 30, 32. Color (opciones): Blanco, Azul." */
export function detallesParaPrompt(detalles: VariantesItem[]): string {
  return detalles.map((d) => `${d.nombre} (opciones): ${d.opciones.join(", ")}.`).join(" ");
}

const dicho = (opcion: string, texto: string) =>
  new RegExp(`(^|[^a-z0-9])${escapar(doblar(opcion))}([^a-z0-9]|$)`).test(doblar(texto));

/** "otra igual", "la misma", "también": el cliente pide repetir lo de antes. */
const REPITE = /\b(igual(es)?|mism[oa]s?|tambien)\b/;

/**
 * T-109: de una combinación que mandó la IA, las opciones que el cliente NO
 * dijo para esa línea (vacío = se puede anotar). En la prueba real, tras "2
 * de la 30 en azul", el cliente escribió "y 1 de la 32" y la IA anotó "32
 * Azul": arrastró el color. Para un mayorista eso es un pedido mal armado,
 * así que el motor no se fía y pregunta.
 *
 * Una opción cuenta como dicha si:
 * - está en el mensaje actual;
 * - el cliente pidió repetir ("otra igual", "también");
 * - la línea ya existe en el carrito (solo cambia la cantidad);
 * - la dijo en un mensaje anterior y ninguna línea del producto la usa
 *   todavía ("quiero el azul" … "la 30"). Si ya la usa otra línea, es
 *   justamente el arrastre que se quiere evitar.
 * Solo aplica con varios detalles: con uno solo la IA no tiene qué arrastrar.
 */
export function opcionesNoDichas(
  service: Service,
  variante: string,
  mensaje: string,
  mensajesAnteriores: string[],
  variantesEnCarrito: string[],
): { nombre: string; opcion: string }[] {
  if (detallesDe(service).length < 2) return [];
  if (variantesEnCarrito.includes(variante) || REPITE.test(doblar(mensaje))) return [];
  const { encontrados } = leerDetalles(service, variante);
  const antes = mensajesAnteriores.join("\n");
  return encontrados.filter(
    (e) =>
      !dicho(e.opcion, mensaje) &&
      !(dicho(e.opcion, antes) && !variantesEnCarrito.some((v) => dicho(e.opcion, v))),
  );
}
