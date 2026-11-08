import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

// Tipografía del design system "Nexo": Plus Jakarta Sans para UI,
// Sora para números/KPIs (ver docs/design/README.md).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
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
