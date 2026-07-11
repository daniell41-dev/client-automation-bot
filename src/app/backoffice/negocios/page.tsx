/**
 * Back office · Negocios: vista global de todos los negocios creados.
 */

import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface NegocioRowView {
  id: string;
  slug: string;
  es_demo: boolean;
  whatsapp_phone_number_id: string | null;
  updated_at: string;
  profiles: { email: string } | null;
  rubros: { nombre: string } | null;
}

export default async function NegociosPage() {
  const supabase = await createUserClient();
  const { data: negocios } = await supabase
    .from("negocios")
    .select(
      "id, slug, es_demo, whatsapp_phone_number_id, updated_at, profiles(email), rubros(nombre)",
    )
    .order("updated_at", { ascending: false });

  const rows = (negocios ?? []) as unknown as NegocioRowView[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Negocios</h1>
        <p className="text-sm text-slate-500">{rows.length} negocios en total</p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Dueño</th>
              <th className="px-4 py-3 font-medium">Rubro</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Demo</th>
              <th className="px-4 py-3 font-medium">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{n.slug}</td>
                <td className="px-4 py-3 text-slate-600">{n.profiles?.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{n.rubros?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {n.whatsapp_phone_number_id ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{n.es_demo ? "Sí" : "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(n.updated_at).toLocaleDateString("es-CO")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
