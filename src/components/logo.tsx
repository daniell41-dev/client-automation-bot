import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (comun.logo). */
const tt = textos.comun.logo;
/**
 * Logo: mark "burbuja-corona" de Aurela (dirección C del design system) + wordmark.
 * El mark va como SVG inline y no como <img> para que la burbuja tome el
 * primario del tema; el oro de la corona y la sonrisa son fijos (reglas de
 * marca: no recolorear).
 */

const BURBUJA =
  "M26 54L35 36l13 12 12-18 12 18 13-12 9 18c1.3 3.8 2 7.9 2 12 0 17.7-16.1 32-36 32-4.6 0-9-.8-13-2.2L30 102l4.6-14.6C28 81.6 24 74.2 24 66c0-4.2.7-8.2 2-12z";

export function LogoMark({
  size = 32,
  variant = "light",
}: {
  size?: number;
  /** dark = sobre fondo night: la burbuja se aclara para no perderse. */
  variant?: "light" | "dark";
}) {
  return (
    <svg
      width={size}
      height={(size * 82) / 80}
      viewBox="20 24 80 82"
      className="block shrink-0"
      aria-hidden="true"
    >
      <path d={BURBUJA} fill={variant === "dark" ? "#A85DB3" : "var(--color-primary)"} />
      <circle cx="35" cy="36" r="3.5" fill="#E8A93A" />
      <circle cx="60" cy="30" r="3.5" fill="#E8A93A" />
      <circle cx="85" cy="36" r="3.5" fill="#E8A93A" />
      <path d="M45 72q15 13 30 0" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  variant = "light",
  caption,
}: {
  /** light = texto oscuro (portal); dark = texto blanco (login/back office). */
  variant?: "light" | "dark";
  /** Línea pequeña bajo el nombre (p. ej. "BACK OFFICE"). */
  caption?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={32} variant={variant} />
      <span className="leading-tight">
        <span
          className={`block font-display text-[17px] font-extrabold tracking-[-0.02em] ${
            variant === "dark" ? "text-white" : "text-ink"
          }`}
        >{tt.aurela}</span>
        {caption && (
          <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            {caption}
          </span>
        )}
      </span>
    </span>
  );
}
