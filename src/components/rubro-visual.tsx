/**
 * Visual por rubro: tinte de fondo, tinta del icono y el icono en sí.
 * Mapea por nombre/slug del rubro a las 4 familias del design system
 * (gastronomía, servicios, salud y bienestar, comercio minorista).
 */

import {
  HeartPulse,
  Scissors,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { parseBusinessConfig } from "@/core/config-schema";
import type { CatalogoConfig } from "@/core/types";

export interface RubroVisual {
  bg: string;
  ink: string;
  Icon: LucideIcon;
}

const FAMILIES: { match: RegExp; visual: RubroVisual }[] = [
  {
    match: /gastro|restaur|comida|parrilla|caf|pizz/i,
    visual: { bg: "bg-rubro-gastro-bg", ink: "text-rubro-gastro-ink", Icon: UtensilsCrossed },
  },
  {
    match: /servicio|peluquer|estetic|belleza|barber|taller/i,
    visual: { bg: "bg-rubro-servicios-bg", ink: "text-rubro-servicios-ink", Icon: Scissors },
  },
  {
    match: /salud|bienestar|farmacia|spa|clinic|consultorio/i,
    visual: { bg: "bg-rubro-salud-bg", ink: "text-rubro-salud-ink", Icon: HeartPulse },
  },
  {
    match: /comercio|tienda|minorista|retail|almacen/i,
    visual: { bg: "bg-rubro-comercio-bg", ink: "text-rubro-comercio-ink", Icon: ShoppingBag },
  },
];

export function rubroVisual(rubroNombre: string | null | undefined): RubroVisual {
  const name = rubroNombre ?? "";
  for (const { match, visual } of FAMILIES) {
    if (match.test(name)) return visual;
  }
  return { bg: "bg-primary-tint", ink: "text-primary-hover", Icon: Store };
}

/**
 * Etiqueta PLURAL de la sección de catálogo (Menú/Servicios/Productos/…).
 *
 * T-21: si el rubro declaró `catalogo.etiqueta`, ese dato manda — es lo que
 * reemplaza la adivinanza. El regex sobre el NOMBRE del rubro queda como
 * respaldo para los rubros que todavía no lo declaran (ninguno debería
 * cambiar de comportamiento al desplegar esto).
 */
export function catalogLabel(
  rubroNombre: string | null | undefined,
  catalogo?: CatalogoConfig,
): string {
  if (catalogo?.etiqueta?.plural) return catalogo.etiqueta.plural;
  const name = rubroNombre ?? "";
  if (/gastro|restaur|comida|parrilla|caf|pizz/i.test(name)) return "Menú";
  if (/servicio|peluquer|estetic|belleza|barber|salud|spa/i.test(name)) return "Servicios";
  return "Catálogo";
}

/**
 * Etiqueta SINGULAR de un ítem del catálogo (Plato/Servicio/Producto/…),
 * para títulos como "Editar producto" o los chips de "campos del negocio".
 */
export function catalogItemLabel(
  rubroNombre: string | null | undefined,
  catalogo?: CatalogoConfig,
): string {
  if (catalogo?.etiqueta?.singular) return catalogo.etiqueta.singular;
  const label = catalogLabel(rubroNombre, catalogo);
  return label === "Menú" ? "Plato" : label === "Servicios" ? "Servicio" : "Producto";
}

/** Textos del editor de Catálogo (T-18) que dependen del rubro — placeholder de categoría y copy del preview de WhatsApp. */
export interface CatalogCopy {
  categoriaPlaceholder: string;
  previewSaludo: string;
  previewSustantivo: string;
  previewCta: string;
}

export function catalogCopy(
  rubroNombre: string | null | undefined,
  catalogo?: CatalogoConfig,
): CatalogCopy {
  // T-21: con `catalogo` declarado, el copy sale de la ETIQUETA y del MODO
  // (cita/pedido), no de adivinar el rubro por su nombre — "Kiosco" o
  // "Bodega" nunca iban a matchear el regex de comercio.
  if (catalogo?.etiqueta) {
    const singular = catalogo.etiqueta.singular.toLowerCase();
    const plural = catalogo.etiqueta.plural.toLowerCase();
    if (catalogo.modoPorDefecto === "cita") {
      return {
        categoriaPlaceholder: "Categoría",
        previewSaludo: `¡Hola! ¿Qué ${plural} ofrecen?`,
        previewSustantivo: `nuestro ${singular}`,
        previewCta: "Reservar turno",
      };
    }
    return {
      categoriaPlaceholder: "Categoría",
      previewSaludo: "¡Hola! ¿Qué tienen disponible?",
      previewSustantivo: `nuestro ${singular}`,
      previewCta: "Agregar al pedido",
    };
  }

  const label = catalogLabel(rubroNombre);
  if (label === "Menú") {
    return {
      categoriaPlaceholder: "Entradas",
      previewSaludo: "¡Hola! ¿Qué tienen hoy?",
      previewSustantivo: "nuestro plato",
      previewCta: "Agregar al pedido",
    };
  }
  if (label === "Servicios") {
    return {
      categoriaPlaceholder: "Faciales",
      previewSaludo: "¡Hola! ¿Qué servicios ofrecen?",
      previewSustantivo: "nuestro servicio",
      previewCta: "Reservar turno",
    };
  }
  // Catálogo (comercio/retail genérico): antes de T-18 caía en la misma
  // rama que "Servicios" (solo se distinguía Menú de "todo lo demás"), así
  // que un negocio de comercio veía "¿Qué servicios ofrecen?" y el CTA
  // "Reservar turno" — no tiene sentido reservar un turno para comprar un producto.
  return {
    categoriaPlaceholder: "Categoría",
    previewSaludo: "¡Hola! ¿Qué tienen disponible?",
    previewSustantivo: "nuestro producto",
    previewCta: "Agregar al pedido",
  };
}

/**
 * Chips de "campos del negocio" que hereda un negocio creado desde este rubro
 * — se usa tanto en la card de cada plantilla (`/backoffice/rubros`) como en
 * el preview en vivo del modal "Nuevo negocio" (`/backoffice/negocios`), así
 * que vive acá para no duplicar el cálculo en dos páginas.
 */
export function camposDelNegocio(
  rubroNombre: string | null | undefined,
  template: unknown,
): string[] {
  const config = parseBusinessConfig(template);
  const catalogo = config?.catalogo;
  const itemLabel = catalogItemLabel(rubroNombre, catalogo);
  const camposConf = catalogo?.campos;
  const campos = [itemLabel, "Precio"];
  // Default `true` cuando el rubro no declaró `catalogo.campos`: preserva
  // exactamente los chips de antes de T-21 para todo lo que ya está cargado.
  if (camposConf?.duracion !== false) campos.push("Duración");
  if (camposConf?.categoria !== false) campos.push("Categoría");
  if (camposConf?.stock) campos.push("Stock");
  campos.push("Disponible");
  if (config?.ai) campos.push("IA + reglas");
  return campos;
}

/**
 * Tipo de citas/reservas que ofrece un negocio creado desde este rubro.
 *
 * A propósito NO usa `modoDelItem`/`esCita`: esas funciones, sin nada
 * declarado, caen a "cita" por diseño (preservan el comportamiento del
 * MOTOR). Acá el objetivo es el opuesto — un indicador informativo que solo
 * cuenta una señal EXPLÍCITA (`reservable`/`modo: "cita"`), o se volvería
 * "Turnos" para casi cualquier rubro y dejaría de decir algo.
 */
export function tipoCitas(rubroNombre: string | null | undefined, template: unknown): string {
  const config = parseBusinessConfig(template);
  if (!config) return "—";
  if (config.services.some((s) => s.reservable === true || s.modo === "cita")) {
    return catalogLabel(rubroNombre, config.catalogo) === "Menú" ? "Reserva de mesa" : "Turnos";
  }
  // Un rubro que vende (sin ningún ítem de cita explícito) no está "sin
  // citas" por descuido — es la forma correcta de atender, y decirlo así en
  // vez de "Sin citas" evita que se lea como una plantilla a medio terminar.
  if (config.catalogo?.modoPorDefecto === "pedido") return "Pedidos por WhatsApp";
  return "Sin citas";
}

/** Tile cuadrado con el icono del rubro. */
export function RubroTile({
  rubroNombre,
  size = "md",
}: {
  rubroNombre: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const { bg, ink, Icon } = rubroVisual(rubroNombre);
  const sizes = {
    sm: "h-9 w-9 rounded-[11px]",
    md: "h-11 w-11 rounded-[13px]",
    lg: "h-[52px] w-[52px] rounded-[14px]",
  };
  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${sizes[size]} ${bg} ${ink}`}>
      <Icon className={iconSizes[size]} />
    </span>
  );
}
