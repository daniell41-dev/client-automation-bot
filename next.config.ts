import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
