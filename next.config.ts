import type { NextConfig } from "next";
import { CABECERAS_SEGURIDAD } from "./src/lib/cabeceras-seguridad";

const nextConfig: NextConfig = {
  // T-61: imagen de Docker chica para el VPS. `next build` deja en
  // .next/standalone un server.js con solo las dependencias que se usan; el
  // Dockerfile copia ahí también public/ y .next/static/.
  output: "standalone",
  // T-97: no anunciar "X-Powered-By: Next.js" (le ahorra a un atacante saber
  // con qué está hecho el sitio para buscar fallas conocidas).
  poweredByHeader: false,
  // T-97: cabeceras de seguridad en todas las rutas (ver src/lib/cabeceras-seguridad.ts).
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_SEGURIDAD }];
  },
  experimental: {
    serverActions: {
      // T-45: el QR de pago se sube por Server Action. El default (1 MB) deja
      // afuera muchas capturas de pantalla de celular; el bucket corta en 2 MB
      // y el resto es margen para el multipart.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
