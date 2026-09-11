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

/** Etiqueta de la sección de catálogo según el rubro (Menú/Servicios/Catálogo). */
export function catalogLabel(rubroNombre: string | null | undefined): string {
  const name = rubroNombre ?? "";
  if (/gastro|restaur|comida|parrilla|caf|pizz/i.test(name)) return "Menú";
  if (/servicio|peluquer|estetic|belleza|barber|salud|spa/i.test(name)) return "Servicios";
  return "Catálogo";
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
