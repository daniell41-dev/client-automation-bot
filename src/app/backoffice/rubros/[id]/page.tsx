/**
 * Back office · Editor de un rubro: datos básicos + plantilla del bot.
 * La plantilla usa el mismo ConfigForm que el portal (misma validación Zod).
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { actualizarRubroMeta, actualizarRubroTemplate } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";
import { ConfigForm } from "@/components/config-form";
import { parseBusinessConfig } from "@/core/config-schema";
import { plantilla } from "@/businesses/_template/config";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

export default async function EditarRubroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createUserClient();
  const { data: rubro } = await supabase
    .from("rubros")
    .select("id, slug, nombre, descripcion, template")
    .eq("id", id)
    .maybeSingle();

  if (!rubro) notFound();

  // Si el template guardado quedó inválido, se parte de la plantilla base.
  const template = parseBusinessConfig(rubro.template) ?? {
    ...plantilla,
    slug: rubro.slug,
    name: rubro.nombre,
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Rubro: {rubro.nombre}</h1>
        <p className="text-sm text-slate-500">slug: {rubro.slug}</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Datos del rubro</h2>
        <ActionForm action={actualizarRubroMeta} submitLabel="Guardar datos">
          <input type="hidden" name="id" value={rubro.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Nombre</label>
              <input name="nombre" required defaultValue={rubro.nombre} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input
                name="descripcion"
                defaultValue={rubro.descripcion ?? ""}
                className={inputCls}
              />
            </div>
          </div>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          Plantilla del bot (lo que hereda cada negocio creado desde este rubro)
        </h2>
        <ConfigForm
          initial={template}
          action={actualizarRubroTemplate}
          fieldName="template"
          hidden={{ id: rubro.id }}
          submitLabel="Guardar plantilla"
        />
      </section>
    </div>
  );
}
