import { INSTAGRAM, PRECIO_DESDE, SITIO, WHATSAPP_VENTAS } from "@/app/landing-config";
import { SUBTITULO_HERO } from "@/components/landing/hero";
import { enlaceInstagram } from "@/lib/enlace-whatsapp";
import { precioNumerico } from "@/lib/precio";

/**
 * Datos estructurados para buscadores: quiénes somos y dónde atendemos
 * (Organization) y, solo si hay precio publicado, el producto con su oferta
 * (T-89). Van en un @graph para que el buscador los lea como un conjunto.
 */
export function jsonLd(precio: string | null = PRECIO_DESDE): string {
  const instagram = enlaceInstagram(INSTAGRAM);
  const telefono = (WHATSAPP_VENTAS ?? "").replace(/\D/g, "");
  const organizacion = {
    "@type": "Organization",
    "@id": `${SITIO}/#organizacion`,
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
  const monto = precioNumerico(precio);
  // Sin precio no hay oferta: schema.org pide un precio real, y uno inventado
  // sería una promesa en los resultados de Google.
  const aplicacion =
    monto === null
      ? null
      : {
          "@type": "SoftwareApplication",
          name: "Nexo",
          applicationCategory: "BusinessApplication",
          operatingSystem: "WhatsApp, Web",
          description: SUBTITULO_HERO,
          provider: { "@id": `${SITIO}/#organizacion` },
          offers: { "@type": "Offer", price: monto, priceCurrency: "COP", url: SITIO },
        };
  const datos = { "@context": "https://schema.org", "@graph": aplicacion ? [organizacion, aplicacion] : [organizacion] };
  // Next recomienda escapar "<" para que un texto no pueda cerrar el <script> (ver docs/guides/json-ld).
  return JSON.stringify(datos).replace(/</g, "\\u003c");
}
