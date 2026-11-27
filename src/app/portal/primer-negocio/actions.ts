"use server";

/**
 * La dueña crea su negocio en el primer ingreso (T-42). Elige el tipo entre
 * los rubros que el admin le asignó al invitarla, y el negocio nace de esa
 * plantilla, validada con Zod (regla 5 de AGENTS.md).
 *
 * Se inserta con el cliente de la DUEÑA: la política `negocios_own` exige
 * que sea suyo y que el rubro le esté asignado, así que la base rechaza un
 * rubro que no le corresponde aunque alguien arme el formulario a mano.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { invalidateBusinessCache } from "@/businesses/business-cache";
import type { ActionState } from "@/components/action-form";
import { configDesdePlantilla, slugDesdeNombre } from "./armar";
import { formato, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.primerNegocio). */
const tt = textos.acciones.primerNegocio;

export async function crearMiNegocio(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const rubroId = String(formData.get("rubroId") ?? "");
  if (nombre.length < 2) return { error: tt.escribaElNombreDe };
  if (!rubroId) return { error: tt.elijaQueTipoDe };

  const supabase = await createUserClient();
  const { data: rubro } = await supabase.from("rubros").select("template").eq("id", rubroId).maybeSingle();
  const plantilla = parseBusinessConfig(rubro?.template);
  if (!plantilla) return { error: tt.eseTipoDeNegocio };

  const base = slugDesdeNombre(nombre) || "negocio";
  // Si el slug ya existe (otro negocio con el mismo nombre), se prueba con
  // un sufijo corto en vez de pedirle a la dueña que invente otro nombre.
  for (const slug of [base, `${base}-${Math.floor(Math.random() * 9000 + 1000)}`]) {
    const config = configDesdePlantilla(plantilla, nombre, slug);
    if (!parseBusinessConfig(config)) return { error: tt.laPlantillaDeEse };
    const { error } = await supabase
      .from("negocios")
      .insert({ owner_id: me.userId, rubro_id: rubroId, slug, config });
    if (!error) {
      invalidateBusinessCache();
      revalidatePath("/portal");
      redirect(`/portal/negocios/${slug}`);
    }
    if (error.code !== "23505") return { error: formato(tt.noSePudoCrear, { message: error.message }) };
  }
  return { error: tt.yaExisteUnNegocio };
}
