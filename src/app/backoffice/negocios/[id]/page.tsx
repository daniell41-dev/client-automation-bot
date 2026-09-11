/**
 * Back office · Detalle de un negocio: datos editables, pausar/activar el
 * bot y eliminarlo. Mismo patrón de "detalle en su propia ruta" que
 * `/backoffice/rubros/[id]`, no un modal-overlay.
 *
 * Alcance de T-11: identidad + edición + pausar/activar + eliminar. Las
 * métricas del negocio (leads totales, citas del mes, tiempo de respuesta —
 * `18-detalle-negocio.png`) quedan fuera; no hay todavía de dónde sacarlas
 * de forma confiable (ver T-07/T-08 del plan).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import {
  actualizarNegocio,
  eliminarNegocio,
  toggleBotActivoNegocio,
} from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";
import { Card, Pill } from "@/components/ui";
import { RubroTile, camposDelNegocio, tipoCitas } from "@/components/rubro-visual";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

interface RubroInfo {
  nombre: string;
  template: unknown;
}

export default async function DetalleNegocioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createUserClient();

  const [{ data: negocio }, { data: clientes }] = await Promise.all([
    supabase
      .from("negocios")
      .select(
        "id, slug, config, owner_id, whatsapp_phone_number_id, rubros(nombre, template)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("id, email").eq("role", "cliente"),
  ]);

  if (!negocio) notFound();

  const config = parseBusinessConfig(negocio.config);
  if (!config) {
    // Config corrupta: no hay nada seguro que editar automáticamente.
    // El admin puede eliminarlo desde acá igual (la action no depende del parseo).
    return (
      <div className="mx-auto max-w-[760px] space-y-5 fade-up">
        <VolverLink />
        <Card title={negocio.slug} subtitle="La configuración guardada no es válida.">
          <p className="text-sm text-ink-mid">
            Contactá a soporte técnico antes de reactivarlo, o eliminalo si fue una
            prueba.
          </p>
          <form action={eliminarNegocio} className="mt-4">
            <input type="hidden" name="id" value={negocio.id} />
            <button type="submit" className="text-sm font-semibold text-warn-ink hover:underline">
              Eliminar negocio
            </button>
          </form>
        </Card>
      </div>
    );
  }

  const rubro = negocio.rubros as unknown as RubroInfo | null;
  const activo = config.botActivo !== false;
  const campos = camposDelNegocio(rubro?.nombre, rubro?.template);
  const citas = tipoCitas(rubro?.nombre, rubro?.template);

  return (
    <div className="mx-auto max-w-[760px] space-y-5 fade-up">
      <VolverLink />

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <RubroTile rubroNombre={rubro?.nombre} size="lg" />
          <div>
            <h1 className="text-[20px] font-extrabold text-ink">{config.name}</h1>
            <p className="text-sm text-ink-mid">
              {rubro?.nombre ?? "—"} · slug: {negocio.slug}
            </p>
            <div className="mt-1.5 flex gap-2">
              <Pill tone={activo ? "success" : "warn"} dot>
                {activo ? "Activo" : "Pausado"}
              </Pill>
              <Pill tone={config.plan === "pro" ? "info" : "neutral"}>
                {config.plan === "pro" ? "Pro" : "Free"}
              </Pill>
            </div>
          </div>
        </div>
        <form action={toggleBotActivoNegocio}>
          <input type="hidden" name="id" value={negocio.id} />
          <input type="hidden" name="next" value={(!activo).toString()} />
          <button
            type="submit"
            className="rounded-[10px] border border-line px-4 py-2 text-sm font-bold text-ink hover:bg-surface-2"
          >
            {activo ? "Pausar bot" : "Activar bot"}
          </button>
        </form>
      </header>

      <Card title="Plantilla heredada" subtitle={`Citas: ${citas}`}>
        <div className="flex flex-wrap gap-1.5">
          {campos.map((campo) => (
            <span
              key={campo}
              className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-mid"
            >
              {campo}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Datos del negocio">
        <ActionForm action={actualizarNegocio} submitLabel="Guardar cambios">
          <input type="hidden" name="id" value={negocio.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Nombre del negocio</label>
              <input
                name="nombre"
                required
                defaultValue={config.name}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cliente dueño</label>
              <select
                name="owner_id"
                required
                defaultValue={negocio.owner_id}
                className={inputCls}
              >
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>WhatsApp (phone_number_id)</label>
              <input
                name="whatsapp_phone_number_id"
                defaultValue={negocio.whatsapp_phone_number_id ?? ""}
                className={inputCls}
                placeholder="Sin conectar"
              />
            </div>
            <div>
              <label className={labelCls}>Plan</label>
              <select name="plan" defaultValue={config.plan ?? "free"} className={inputCls}>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>
        </ActionForm>
      </Card>

      <Card title="Zona de riesgo" subtitle="No se puede deshacer.">
        <form action={eliminarNegocio}>
          <input type="hidden" name="id" value={negocio.id} />
          <button type="submit" className="text-sm font-semibold text-warn-ink hover:underline">
            Eliminar negocio
          </button>
        </form>
      </Card>
    </div>
  );
}

function VolverLink() {
  return (
    <Link
      href="/backoffice/negocios"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mid hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver a Negocios
    </Link>
  );
}
