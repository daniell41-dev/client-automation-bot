import type { MetadataRoute } from "next";
import { urlDelSitio } from "@/lib/sitio";

/** T-71: solo las páginas públicas; todo lo demás pide login. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitio = await urlDelSitio();
  return [
    { url: `${sitio}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${sitio}/demo`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${sitio}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
