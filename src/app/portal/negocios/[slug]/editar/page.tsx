/**
 * Portal · Editor de la configuración del negocio.
 * Usa el ConfigForm compartido (validación Zod en el servidor) y un form
 * aparte para la conexión de WhatsApp (phone_number_id).
 */

import { notFound } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { actualizarConfig, actualizarWhatsapp } from "@/app/portal/actions";
import { ActionForm } from "@/components/action-form";
import { ConfigForm } from "@/components/config-form";
import { parseBusinessConfig } from "@/core/config-schema";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

export default async function EditarNegocioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createUserClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id, slug, config, whatsapp_phone_number_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();

  const config = parseBusinessConfig(negocio.config);
  if (!config) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-sm text-red-700">
        La configuración guardada es inválida. Contacta al administrador.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Editar: {config.name}</h1>
        <p className="text-sm text-slate-500">
          Los cambios se aplican de inmediato: el bot responde con esta configuración.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">
          Conexión de WhatsApp
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Phone number ID de tu número en Meta (docs/05-whatsapp-setup.md).
          Déjalo vacío para desconectar.
        </p>
        <ActionForm action={actualizarWhatsapp} submitLabel="Guardar conexión">
          <input type="hidden" name="slug" value={negocio.slug} />
          <div className="max-w-sm">
            <label className={labelCls}>WhatsApp phone number ID</label>
            <input
              name="whatsapp_phone_number_id"
              defaultValue={negocio.whatsapp_phone_number_id ?? ""}
              className={inputCls}
              placeholder="123456789012345"
            />
          </div>
        </ActionForm>
      </section>

      <ConfigForm
        initial={config}
        action={actualizarConfig}
        fieldName="config"
        hidden={{ slug: negocio.slug }}
        submitLabel="Guardar configuración"
      />
    </div>
  );
}
