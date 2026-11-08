import type { MetadataRoute } from "next";
import { urlDelSitio } from "@/lib/sitio";

/**
 * T-71: los buscadores solo ven lo público. El portal y el back office ya
 * piden login, pero sin esto Google puede indexar la pantalla de "iniciá
 * sesión" de cada ruta privada que encuentre enlazada.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitio = await urlDelSitio();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/portal", "/backoffice", "/admin", "/cuenta", "/auth", "/api"],
    },
    sitemap: `${sitio}/sitemap.xml`,
  };
}
