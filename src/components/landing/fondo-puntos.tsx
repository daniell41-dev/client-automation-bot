/**
 * T-82: rejilla de puntos muy tenue sobre el fondo oscuro del hero. Da textura
 * sin competir con el texto (puntos de 1 px al 12 % de opacidad). SVG inline:
 * no pide ningún archivo extra y escala sin pixelarse.
 */

export function FondoPuntos() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]">
      <defs>
        <pattern id="landing-puntos" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="#ffffff" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#landing-puntos)" />
    </svg>
  );
}
