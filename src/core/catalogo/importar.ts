/**
 * T-116: carga masiva de productos desde un archivo (Excel/CSV).
 *
 * Un mayorista de jeans tiene 116 referencias con 6 tallas cada una; cargarlas
 * a mano una por una no es realista. Este módulo convierte las filas de un
 * archivo en productos de Aurela y los combina con el catálogo actual. Es
 * puro: no lee archivos ni escribe en la base (eso es del adaptador y de la
 * Server Action, T-117), así que el día que los productos salgan del JSON de
 * `negocios.config` a una tabla propia, esto no se reescribe.
 *
 * Decisiones:
 * - **Lista blanca de columnas.** Solo se leen las columnas mapeadas. El
 *   archivo de Tienda Nube trae "Costo": si llegara al catálogo, la IA podría
 *   decírselo a un cliente. Nada que no esté en el mapeo entra.
 * - **La referencia es la llave.** Volver a subir la lista con precios nuevos
 *   actualiza los productos existentes en vez de duplicarlos.
 * - **Una fila por talla o una fila por producto, ambas valen.** Tienda Nube
 *   exporta una fila por talla; la plantilla de Aurela, una por producto con
 *   "6, 8, 10". Las filas con la misma referencia se juntan en un producto.
 * - **Errores por fila, con el número que la dueña ve en Excel.** Una fila
 *   mala no tumba la importación: se informa y las demás siguen.
 */

import { servicesSchema } from "@/core/config-schema";
import { foldAccents } from "@/core/engine/text-normalize";
import type { Service, VariantesItem } from "@/core/types";

/** Tope por importación: protege al navegador y al guardado de un archivo equivocado (un export de 50.000 filas). */
export const MAX_FILAS_IMPORTACION = 5000;

/**
 * Qué columna del archivo alimenta cada campo de Aurela. Los nombres son los
 * encabezados tal como vienen en el archivo.
 */
export interface MapeoColumnas {
  referencia: string;
  nombre: string;
  precio: string;
  /** Tienda Nube trae un precio normal y uno promocional. */
  precioPromocional?: string;
  categoria?: string;
  descripcion?: string;
  stock?: string;
  disponible?: string;
  /**
   * Opciones en pares de columnas, una fila por opción (Tienda Nube:
   * "Nombre de propiedad 1" = "Talla", "Valor de propiedad 1" = "10").
   */
  propiedades?: { columnaNombre: string; columnaValor: string }[];
  /** Opciones como lista en una celda ("6, 8, 10"), con el nombre del detalle fijo (plantilla de Aurela). */
  listas?: { detalle: string; columna: string }[];
}

export type FormatoArchivo = "tiendanube" | "aurela" | "otro";

export interface OpcionesImportacion {
  /** Usar el precio promocional cuando la fila lo trae (lo decide la dueña en la vista previa). */
  usarPrecioPromocional?: boolean;
}

export interface ErrorFila {
  /** Número de fila como lo ve la dueña en Excel (la 1 es la de encabezados). */
  fila: number;
  mensaje: string;
}

export interface LecturaArchivo {
  productos: Service[];
  errores: ErrorFila[];
  /** Cosas que no frenan la importación pero conviene que la dueña vea. */
  avisos: ErrorFila[];
}

/* ------------------------------------------------------------------ */
/* Formatos conocidos                                                  */
/* ------------------------------------------------------------------ */

/** Encabezados de la exportación de productos de Tienda Nube. */
export const MAPEO_TIENDANUBE: MapeoColumnas = {
  referencia: "MPN (Número de pieza del fabricante)",
  nombre: "Nombre",
  precio: "Precio",
  precioPromocional: "Precio promocional",
  categoria: "Categorías",
  descripcion: "Descripción",
  stock: "Stock",
  disponible: "Mostrar en tienda",
  propiedades: [1, 2, 3].map((n) => ({
    columnaNombre: `Nombre de propiedad ${n}`,
    columnaValor: `Valor de propiedad ${n}`,
  })),
};

/** La plantilla que se descarga desde Aurela (T-117 la ofrece en la pantalla de importar). */
export const MAPEO_AURELA: MapeoColumnas = {
  referencia: "Referencia",
  nombre: "Nombre",
  precio: "Precio",
  categoria: "Categoría",
  descripcion: "Descripción",
  stock: "Unidades disponibles",
  disponible: "Disponible",
  listas: [
    { detalle: "Talla", columna: "Tallas" },
    { detalle: "Color", columna: "Colores" },
  ],
};

export const ENCABEZADOS_PLANTILLA_AURELA = [
  "Referencia",
  "Nombre",
  "Precio",
  "Categoría",
  "Descripción",
  "Tallas",
  "Colores",
  "Unidades disponibles",
  "Disponible",
];

const clave = (t: string) => foldAccents(t).toLowerCase().replace(/\s+/g, " ").trim();

/** Qué formato es, por sus encabezados (sin importar tildes ni mayúsculas). */
export function detectarFormato(encabezados: string[]): FormatoArchivo {
  const tiene = new Set(encabezados.map(clave));
  if (["identificador de url", "nombre de propiedad 1", "valor de propiedad 1", "precio promocional"].every((h) => tiene.has(h))) {
    return "tiendanube";
  }
  if (["referencia", "nombre", "precio"].every((h) => tiene.has(h))) return "aurela";
  return "otro";
}

/**
 * Para un archivo de otro origen: adivina qué columna es cada campo por
 * sinónimos comunes. La dueña confirma o corrige en la pantalla (T-117); lo
 * que no se reconoce queda vacío, nunca se inventa.
 */
export function sugerirMapeo(encabezados: string[]): Partial<MapeoColumnas> {
  const buscar = (...sinonimos: string[]) =>
    encabezados.find((h) => sinonimos.some((s) => clave(h) === s)) ??
    encabezados.find((h) => sinonimos.some((s) => clave(h).includes(s)));
  const sugerido: Partial<MapeoColumnas> = {
    referencia: buscar("referencia", "ref", "codigo", "sku", "mpn", "cod"),
    nombre: buscar("nombre", "producto", "articulo", "descripcion corta"),
    precio: buscar("precio", "valor", "precio de venta", "pvp"),
    categoria: buscar("categoria", "categorias", "linea", "tipo"),
    descripcion: buscar("descripcion", "detalle"),
    stock: buscar("stock", "existencia", "existencias", "unidades", "cantidad", "inventario"),
    disponible: buscar("disponible", "activo", "mostrar en tienda", "visible"),
  };
  const tallas = buscar("tallas", "talla");
  const colores = buscar("colores", "color");
  const listas = [
    ...(tallas ? [{ detalle: "Talla", columna: tallas }] : []),
    ...(colores ? [{ detalle: "Color", columna: colores }] : []),
  ];
  if (listas.length) sugerido.listas = listas;
  // "Descripción" no puede ser a la vez el nombre.
  if (sugerido.descripcion && sugerido.descripcion === sugerido.nombre) delete sugerido.descripcion;
  return sugerido;
}

export function mapeoDeFormato(formato: FormatoArchivo, encabezados: string[]): Partial<MapeoColumnas> {
  if (formato === "tiendanube") return MAPEO_TIENDANUBE;
  if (formato === "aurela") return MAPEO_AURELA;
  return sugerirMapeo(encabezados);
}

/* ------------------------------------------------------------------ */
/* Lectura de valores                                                  */
/* ------------------------------------------------------------------ */

/**
 * "$ 129.900", "129900", "129.900,00", "99900.5" → número. En Colombia el
 * punto separa miles; si después del último separador hay 3 dígitos, es de
 * miles, no decimal. `null` si no es un precio.
 */
export function leerPrecio(texto: string): number | null {
  const t = texto.replace(/[$\s]|COP/gi, "");
  if (!t) return null;
  if (!/^\d[\d.,]*$/.test(t)) return null;
  let normal: string;
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) normal = t.replace(/[.,]/g, "");
  else if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(t)) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})*\.\d{1,2}$/.test(t)) normal = t.replace(/,/g, "");
  else if (/^\d+([.,]\d{1,2})?$/.test(t)) normal = t.replace(",", ".");
  else return null;
  const n = Math.round(Number(normal));
  return Number.isFinite(n) ? n : null;
}

function leerSiNo(texto: string): boolean | undefined {
  const t = clave(texto);
  if (!t) return undefined;
  if (["si", "s", "yes", "true", "1", "x", "activo", "disponible"].includes(t)) return true;
  if (["no", "n", "false", "0", "inactivo", "agotado"].includes(t)) return false;
  return undefined;
}

/** "ref-b203": estable para la misma referencia, así reimportar no cambia el id. */
function idDeReferencia(referencia: string): string {
  const slug = foldAccents(referencia)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ref-${slug || "producto"}`;
}

/** Tienda Nube repite la referencia en el nombre ("… azul hielo ref:B203"); ya va en su campo. */
function limpiarNombre(nombre: string, referencia: string): string {
  const escapada = referencia.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return nombre.replace(new RegExp(`\\s*[-–(]?\\s*ref\\.?\\s*:?\\s*${escapada}\\)?\\s*$`, "i"), "").trim() || nombre.trim();
}

/** Agrega una opción sin repetirla ("M" y "m " son la misma). */
function agregarOpcion(detalles: VariantesItem[], nombre: string, valor: string): void {
  const n = nombre.trim();
  const v = valor.trim();
  if (!n || !v) return;
  let detalle = detalles.find((d) => clave(d.nombre) === clave(n));
  if (!detalle) {
    detalle = { nombre: n, opciones: [] };
    detalles.push(detalle);
  }
  if (!detalle.opciones.some((o) => clave(o) === clave(v))) detalle.opciones.push(v);
}

/* ------------------------------------------------------------------ */
/* Filas → productos                                                   */
/* ------------------------------------------------------------------ */

interface Acumulado {
  fila: number;
  producto: Service;
  detalles: VariantesItem[];
}

export function leerProductos(
  encabezados: string[],
  filas: string[][],
  mapeo: MapeoColumnas,
  opciones: OpcionesImportacion = {},
): LecturaArchivo {
  const errores: ErrorFila[] = [];
  const avisos: ErrorFila[] = [];
  if (filas.length > MAX_FILAS_IMPORTACION) {
    return {
      productos: [],
      errores: [{ fila: 0, mensaje: `El archivo tiene ${filas.length} filas; el máximo por importación es ${MAX_FILAS_IMPORTACION}.` }],
      avisos,
    };
  }

  const indice = new Map(encabezados.map((h, i) => [clave(h), i]));
  const col = (nombre?: string) => (nombre ? indice.get(clave(nombre)) : undefined);
  const faltantes = (["referencia", "nombre", "precio"] as const).filter((c) => col(mapeo[c]) === undefined);
  if (faltantes.length) {
    return {
      productos: [],
      errores: [{ fila: 1, mensaje: `Faltan columnas obligatorias en el archivo: ${faltantes.join(", ")}.` }],
      avisos,
    };
  }
  const valor = (fila: string[], nombre?: string) => {
    const i = col(nombre);
    return i === undefined ? "" : (fila[i] ?? "").trim();
  };

  const porReferencia = new Map<string, Acumulado>();
  filas.forEach((fila, i) => {
    const numero = i + 2;
    const referencia = valor(fila, mapeo.referencia);
    const nombre = valor(fila, mapeo.nombre);
    if (!referencia) {
      errores.push({ fila: numero, mensaje: "Falta la referencia." });
      return;
    }
    const llave = clave(referencia);
    const existente = porReferencia.get(llave);

    // Las opciones de esta fila (aunque sea una fila "de talla" de un producto ya visto).
    const detallesFila: VariantesItem[] = [];
    for (const p of mapeo.propiedades ?? []) agregarOpcion(detallesFila, valor(fila, p.columnaNombre), valor(fila, p.columnaValor));
    for (const l of mapeo.listas ?? []) {
      for (const op of valor(fila, l.columna).split(/[,;/|]/)) agregarOpcion(detallesFila, l.detalle, op);
    }

    const precioNormal = leerPrecio(valor(fila, mapeo.precio));
    const promo = leerPrecio(valor(fila, mapeo.precioPromocional));
    const precio = opciones.usarPrecioPromocional && promo !== null && promo > 0 ? promo : precioNormal;

    if (existente) {
      for (const d of detallesFila) for (const o of d.opciones) agregarOpcion(existente.detalles, d.nombre, o);
      if (precio !== null && precio !== existente.producto.price) {
        avisos.push({
          fila: numero,
          mensaje: `La referencia ${referencia} tiene otro precio en esta fila; se usó el de la fila ${existente.fila}.`,
        });
      }
      return;
    }

    if (!nombre) {
      errores.push({ fila: numero, mensaje: `Falta el nombre (referencia ${referencia}).` });
      return;
    }
    if (precio === null) {
      errores.push({ fila: numero, mensaje: `El precio de ${referencia} no es un número válido.` });
      return;
    }

    const stockTexto = valor(fila, mapeo.stock);
    const stock = stockTexto === "" ? undefined : Number(stockTexto.replace(/[.,]/g, ""));
    if (stock !== undefined && !(Number.isInteger(stock) && stock >= 0)) {
      avisos.push({ fila: numero, mensaje: `Las unidades de ${referencia} no son un número; se cargó sin control de unidades.` });
    }
    const disponible = leerSiNo(valor(fila, mapeo.disponible));
    const categoria = valor(fila, mapeo.categoria);

    porReferencia.set(llave, {
      fila: numero,
      detalles: detallesFila,
      producto: {
        id: idDeReferencia(referencia),
        name: limpiarNombre(nombre, referencia),
        description: valor(fila, mapeo.descripcion),
        price: precio,
        // Explícito: un catálogo importado se vende (cantidad), no se agenda.
        modo: "pedido",
        referencia,
        ...(categoria && { categoria }),
        ...(disponible !== undefined && { disponible }),
        ...(stock !== undefined && Number.isInteger(stock) && stock >= 0 && { stock }),
      },
    });
  });

  // Cada producto pasa por el mismo schema que el editor del Menú (regla 5):
  // así el error sale aquí, con su fila, y no al guardar todo el catálogo.
  const productos: Service[] = [];
  for (const { fila, producto, detalles } of porReferencia.values()) {
    const completo: Service = detalles.length ? { ...producto, detalles: detalles.slice(0, 3) } : producto;
    if (detalles.length > 3) {
      avisos.push({ fila, mensaje: `${producto.referencia} tiene más de 3 tipos de opciones; se cargaron los 3 primeros.` });
    }
    const revision = servicesSchema.safeParse([completo]);
    if (!revision.success) {
      errores.push({ fila, mensaje: `${producto.referencia}: ${revision.error.issues[0]?.message ?? "datos inválidos"}` });
      continue;
    }
    productos.push(completo);
  }
  return { productos, errores, avisos };
}

/* ------------------------------------------------------------------ */
/* Combinar con el catálogo actual                                     */
/* ------------------------------------------------------------------ */

export interface ResumenImportacion {
  nuevos: number;
  actualizados: number;
  sinCambios: number;
  /** Productos del catálogo que no venían en el archivo: se dejan como estaban. */
  noIncluidos: number;
}

/** Lo que el archivo puede cambiar de un producto existente. El resto (modo, palabras clave, notas) es de la dueña. */
const CAMPOS_IMPORTADOS = ["name", "description", "price", "categoria", "disponible", "stock", "detalles"] as const;

/**
 * Agrega los productos nuevos y actualiza los existentes por referencia. Lo
 * que no viene en el archivo no se toca: subir una lista parcial (solo los
 * shorts) nunca borra el resto.
 */
export function combinarCatalogo(
  actual: Service[],
  importados: Service[],
): { catalogo: Service[]; resumen: ResumenImportacion } {
  const resumen: ResumenImportacion = { nuevos: 0, actualizados: 0, sinCambios: 0, noIncluidos: 0 };
  const porReferencia = new Map(importados.map((p) => [clave(p.referencia ?? ""), p]));
  const usados = new Set<string>();
  const ids = new Set(actual.map((s) => s.id));

  const catalogo = actual.map((existente) => {
    const ref = existente.referencia ? clave(existente.referencia) : "";
    const nuevo = ref ? porReferencia.get(ref) : undefined;
    if (!nuevo) {
      resumen.noIncluidos++;
      return existente;
    }
    usados.add(ref);
    const actualizado: Service = { ...existente, variantes: undefined };
    for (const campo of CAMPOS_IMPORTADOS) {
      const v = nuevo[campo];
      if (v === undefined) delete actualizado[campo];
      else (actualizado as unknown as Record<string, unknown>)[campo] = v;
    }
    // Las opciones viejas de T-104 (`variantes`) pasan a `detalles` si el archivo no trae ninguna.
    if (!actualizado.detalles && existente.variantes) actualizado.detalles = [existente.variantes];
    if (!actualizado.variantes) delete actualizado.variantes;
    const igual = CAMPOS_IMPORTADOS.every(
      (c) => JSON.stringify(actualizado[c]) === JSON.stringify(c === "detalles" ? existente.detalles ?? (existente.variantes ? [existente.variantes] : undefined) : existente[c]),
    );
    if (igual) resumen.sinCambios++;
    else resumen.actualizados++;
    return igual ? existente : actualizado;
  });

  for (const p of importados) {
    if (usados.has(clave(p.referencia ?? ""))) continue;
    // Un id ya usado por otro producto (uno cargado a mano con ese mismo id) no se pisa.
    let id = p.id;
    for (let n = 2; ids.has(id); n++) id = `${p.id}-${n}`;
    ids.add(id);
    catalogo.push({ ...p, id });
    resumen.nuevos++;
  }
  return { catalogo, resumen };
}
