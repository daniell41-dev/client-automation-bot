/**
 * T-97: cabeceras de seguridad para todas las respuestas del sitio.
 *
 * Por qué cada una:
 * - X-Frame-Options + CSP frame-ancestors: ninguna otra página puede meter
 *   la app en un <iframe>. Sin esto, alguien podía mostrar el login o el
 *   portal dentro de su sitio, con botones falsos encima (clickjacking).
 *   Van las dos porque navegadores viejos solo entienden la primera. La CSP
 *   lleva SOLO frame-ancestors a propósito: una política completa (scripts,
 *   estilos) necesita nonces por request y es otra tarea; a medias rompería
 *   la página.
 * - Strict-Transport-Security: el navegador recuerda por dos años que el
 *   sitio es solo HTTPS y no vuelve a intentar http (evita que alguien en
 *   un wifi público intercepte la primera visita). includeSubDomains cubre
 *   www; sin "preload" porque eso no se puede deshacer rápido.
 * - X-Content-Type-Options: el navegador no "adivina" que un archivo es
 *   script; usa el tipo que declaramos.
 * - Referrer-Policy: al salir hacia otro sitio solo se manda el dominio, no
 *   la ruta (las del portal pueden llevar ids).
 * - Permissions-Policy: la app no usa cámara, micrófono, ubicación ni la API
 *   de pagos del navegador; apagadas, ni un script inyectado puede pedirlas.
 */

export const CABECERAS_SEGURIDAD = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];
