"use server";

/**
 * T-155: la dueña toma un chat (el asistente se calla en esa conversación) o
 * se lo devuelve al asistente. Escribe solo `atencion_humana_desde` del lead:
 * con el cliente del usuario, RLS (`leads_own_update`, migración 0008) deja
 * tocar únicamente los leads de sus negocios.
 */

import { revalidatePath } from "next/cache";
import { createUserClient, getUserRole } from "@/lib/supabase/server";
import { textos } from "@/textos";

const tt = textos.portal.conversaciones;

export async function cambiarAtencionHumana(
  slug: string,
  contacto: string,
  tomar: boolean,
): Promise<{ ok: true } | { error: string }> {
  const me = await getUserRole();
  if (!me) return { error: tt.noAutorizado };

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ atencion_humana_desde: tomar ? new Date().toISOString() : null })
    .eq("business_slug", slug)
    .eq("contact", contacto)
    .select("id");
  if (error) return { error: tt.noSePudoCambiar };
  // Sin filas: el chat no tiene cliente registrado (o no es de sus negocios).
  if (!data?.length) return { error: tt.chatNoEncontrado };

  revalidatePath(`/portal/negocios/${slug}/conversaciones`);
  revalidatePath(`/portal/negocios/${slug}`);
  revalidatePath("/portal");
  return { ok: true };
}
