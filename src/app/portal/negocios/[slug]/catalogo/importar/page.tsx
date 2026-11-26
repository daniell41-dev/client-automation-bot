/**
 * T-117: Portal · Menú → Importar productos. Carga masiva desde un archivo
 * (exportación de Tienda Nube, plantilla de Aurela u otro CSV). La lectura y
 * la vista previa pasan en el navegador (`importar-productos.tsx`); guardar es
 * `importarProductos` en `app/portal/actions.ts`.
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { ImportarProductos } from "./importar-productos";
import { textos } from "@/textos";

export const dynamic = "force-dynamic";

export default async function ImportarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createUserClient();
  const { data: negocio } = await supabase.from("negocios").select("config").eq("slug", slug).maybeSingle();
  if (!negocio) notFound();
  const config = parseBusinessConfig(negocio.config);
  if (!config) notFound();

  return (
    <ImportarProductos
      slug={slug}
      catalogoActual={config.services}
      currency={config.currency}
      locale={config.locale ?? "es-CO"}
      respaldo={config.respaldoCatalogo ? { fecha: config.respaldoCatalogo.fecha, cantidad: config.respaldoCatalogo.services.length } : null}
    />
  );
}

export const metadata = { title: textos.portal.titulosPestana.importar };
