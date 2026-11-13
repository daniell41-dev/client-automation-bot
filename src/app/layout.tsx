import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

// Tipografía del design system "Nexo": Plus Jakarta Sans para UI,
// Sora para números/KPIs (ver docs/design/README.md).
//
// T-77: las fuentes viven en el repo (`./fonts`, versión variable, subset
// latín — cubre tildes y ñ) en vez de `next/font/google`. Con Google el build
// descargaba la fuente en cada compilación y, si Google respondía raro, el
// build se caía (pasó en el CI de la v1.0.2). Así CI y el despliegue no
// dependen de una red externa. Licencia OFL: ver `fonts/LICENSE-*.txt`.
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

const sora = localFont({
  src: "./fonts/sora.woff2",
  variable: "--font-sora",
  weight: "100 800",
  display: "swap",
});

/**
 * T-71: URL pública para armar links absolutos. WhatsApp y Facebook solo
 * muestran la tarjeta del link (imagen Open Graph) si la URL de la imagen es
 * absoluta; sin `NEXT_PUBLIC_SITE_URL` (desarrollo) queda localhost.
 */
const SITIO = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

const DESCRIPCION =
  "Nexo responde el WhatsApp de tu negocio, arma el pedido con el total, revisa el comprobante y te avisa para aprobar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  // "Pedidos · Nexo": la dueña suele tener varias pestañas abiertas, y el
  // nombre de la sección es lo que la ayuda a encontrar la que busca.
  title: { default: "Nexo — Tu negocio vende por WhatsApp las 24 horas", template: "%s · Nexo" },
  description: DESCRIPCION,
  applicationName: "Nexo",
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Nexo",
    title: "Nexo — Tu negocio vende por WhatsApp las 24 horas",
    description: DESCRIPCION,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
