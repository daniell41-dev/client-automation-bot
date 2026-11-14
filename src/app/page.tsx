/**
 * T-80: landing de venta. Un solo objetivo: que la dueña de un negocio de
 * Cúcuta toque "Escríbanos por WhatsApp". Los textos los escribió el dueño del
 * producto y van tal cual: nada de cifras ni promesas que no podamos cumplir.
 *
 * Estática a propósito (sin Supabase ni sesión): carga rápido en un celular
 * con datos y no depende de que la base esté arriba para vender.
 */

import type { Metadata } from "next";
import { INSTAGRAM, SITIO, WHATSAPP_VENTAS } from "@/app/landing-config";
import { enlaceInstagram } from "@/lib/enlace-whatsapp";
import { BarraMovil } from "@/components/landing/barra-movil";
import { Cierre } from "@/components/landing/cierre";
import { ComoFunciona } from "@/components/landing/como-funciona";
import { Control } from "@/components/landing/control";
import { Encabezado } from "@/components/landing/encabezado";
import { FondoPuntos } from "@/components/landing/fondo-puntos";
import { Hero, SUBTITULO_HERO } from "@/components/landing/hero";
import { Instalacion } from "@/components/landing/instalacion";
import { Negocios } from "@/components/landing/negocios";
import { Perdidas } from "@/components/landing/perdidas";
import { Pie } from "@/components/landing/pie";
import { Precio } from "@/components/landing/precio";
import { Preguntas } from "@/components/landing/preguntas";
import { Testimonios } from "@/components/landing/testimonios";

const TITULO = "Nexo · Pedidos, citas y pagos por WhatsApp en Cúcuta";

export const metadata: Metadata = {
  // `absolute`: la plantilla del layout ("%s · Nexo") repetiría la marca.
  title: { absolute: TITULO },
  description: SUBTITULO_HERO,
  // Relativa: `metadataBase` (layout) la completa con NEXT_PUBLIC_SITE_URL.
  alternates: { canonical: "/" },
  // La imagen sale de `opengraph-image.png` (convención de archivo), no se repite acá.
  openGraph: { title: TITULO, description: SUBTITULO_HERO, url: "/" },
};

/** Datos estructurados para buscadores: quiénes somos y dónde atendemos. */
function jsonLd(): string {
  const instagram = enlaceInstagram(INSTAGRAM);
  const telefono = (WHATSAPP_VENTAS ?? "").replace(/\D/g, "");
  const organizacion = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Nexo",
    url: SITIO,
    logo: `${SITIO}/apple-icon.png`,
    description: SUBTITULO_HERO,
    areaServed: { "@type": "City", name: "Cúcuta", containedInPlace: { "@type": "Country", name: "Colombia" } },
    ...(instagram ? { sameAs: [instagram] } : {}),
    ...(/^57\d{10}$/.test(telefono)
      ? { contactPoint: { "@type": "ContactPoint", telephone: `+${telefono}`, contactType: "sales", areaServed: "CO", availableLanguage: "es" } }
      : {}),
  };
  // Next recomienda escapar "<" para que un texto no pueda cerrar el <script> (ver docs/guides/json-ld).
  return JSON.stringify(organizacion).replace(/</g, "\\u003c");
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      {/* pb-24: en el celular la barra fija de WhatsApp no tapa el pie. */}
      <main className="bg-canvas pb-24 sm:pb-0">
        <div
          className="relative overflow-hidden"
          style={{
            background:
              "radial-gradient(80% 60% at 50% 0%, rgba(42,111,219,.28) 0%, rgba(14,32,51,0) 55%), #0E2033",
          }}
        >
          <FondoPuntos />
          <div className="relative">
            <Encabezado />
            <Hero />
          </div>
        </div>
        <Perdidas />
        <ComoFunciona />
        <Negocios />
        <Control />
        <Instalacion />
        <Precio />
        <Testimonios />
        <Preguntas />
        <Cierre />
      </main>
      <Pie />
      <BarraMovil />
    </>
  );
}
