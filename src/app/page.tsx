/**
 * T-80: landing de venta. Un solo objetivo: que la dueña de un negocio de
 * Cúcuta toque "Escríbanos por WhatsApp". Los textos los escribió el dueño del
 * producto y van tal cual: nada de cifras ni promesas que no podamos cumplir.
 *
 * Estática a propósito (sin Supabase ni sesión): carga rápido en un celular
 * con datos y no depende de que la base esté arriba para vender.
 */

import type { Metadata } from "next";
import { jsonLd } from "@/components/landing/datos-estructurados";
import { BarraMovil } from "@/components/landing/barra-movil";
import { Cierre } from "@/components/landing/cierre";
import { TalonComanda } from "@/components/landing/comanda";
import { ComoFunciona } from "@/components/landing/como-funciona";
import { Comprobante } from "@/components/landing/comprobante";
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
import { Responsable } from "@/components/landing/responsable";
import { Testimonios } from "@/components/landing/testimonios";

const TITULO = "WhatsApp con pedidos, citas y revisión de pagos para negocios de Cúcuta · Nexo";

export const metadata: Metadata = {
  // `absolute`: la plantilla del layout ("%s · Nexo") repetiría la marca.
  title: { absolute: TITULO },
  description: SUBTITULO_HERO,
  // Relativa: `metadataBase` (layout) la completa con NEXT_PUBLIC_SITE_URL.
  alternates: { canonical: "/" },
  // T-89: la imagen sale de `opengraph-image.tsx` (generada con código), no se repite acá.
  openGraph: { title: TITULO, description: SUBTITULO_HERO, url: "/" },
};

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
        {/* T-95: los talones del pedido #128 van sobre el borde entre secciones. */}
        <TalonComanda momento="nota" />
        <Perdidas />
        <TalonComanda momento="total" />
        <Comprobante />
        <TalonComanda momento="comprobante" />
        <ComoFunciona />
        <Negocios />
        <Control />
        <TalonComanda momento="aprobado" />
        <Instalacion />
        <Responsable />
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
