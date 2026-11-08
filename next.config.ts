import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // T-61: imagen de Docker chica para el VPS. `next build` deja en
  // .next/standalone un server.js con solo las dependencias que se usan; el
  // Dockerfile copia ahí también public/ y .next/static/.
  output: "standalone",
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
