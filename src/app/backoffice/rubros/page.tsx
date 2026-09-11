/**
 * Back office · Rubros (plantillas): cada plantilla define los campos que un
 * negocio de ese rubro podrá cargar (su CRUD) y el tipo de citas.
 */

import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { crearRubro, eliminarRubro } from "@/app/backoffice/actions";
import { ActionForm } from "@/components/action-form";
import { Card, Pill } from "@/components/ui";
import { RubroTile, catalogLabel } from "@/components/rubro-visual";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls =
  "input-nexo w-full px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft";

/** Chips de "campos del negocio" derivados de la plantilla del rubro. */
function camposDelNegocio(rubroNombre: string, template: unknown): string[] {
  const config = parseBusinessConfig(template);
  const itemLabel =
    catalogLabel(rubroNombre) === "Menú"
      ? "Plato"
      : catalogLabel(rubroNombre) === "Servicios"
        ? "Servicio"
        : "Producto";
  const campos = [itemLabel, "Precio", "Duración", "Categoría", "Disponible"];
  if (config?.ai) campos.push("IA + reglas");
  return campos;
}

function tipoCitas(rubroNombre: string, template: unknown): string {
  const config = parseBusinessConfig(template);
  if (!config) return "—";
  if (config.services.some((s) => s.reservable)) {
    return catalogLabel(rubroNombre) === "Menú" ? "Reserva de mesa" : "Turnos";
  }
  return "Sin citas";
}

export default async function RubrosPage() {
  const supabase = await createUserClient();

  const [{ data: rubros }, { data: negocios }] = await Promise.all([
    supabase
      .from("rubros")
      .select("id, slug, nombre, descripcion, template, es_demo")
      .order("created_at", { ascending: false }),
    supabase.from("negocios").select("rubro_id"),
  ]);

  const negociosPorRubro = new Map<string, number>();
  for (const n of negocios ?? []) {
    negociosPorRubro.set(n.rubro_id, (negociosPorRubro.get(n.rubro_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-[980px] space-y-5 fade-up">
      {/* Banner informativo */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-tint p-4 text-sm text-ink">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Cada <strong>plantilla</strong> define los campos que un negocio de ese
          rubro podrá cargar (su CRUD) y el tipo de citas. Al asignar un rubro a
          un cliente, su negocio hereda esta estructura.
        </p>
      </div>

      {/* Crear plantilla */}
      <Card title="Nueva plantilla" subtitle="Nace con la plantilla base; después la personalizás.">
        <ActionForm action={crearRubro} submitLabel="Crear plantilla">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Slug (kebab-case)</label>
              <input name="slug" required className={inputCls} placeholder="barberia" />
            </div>
            <div>
              <label className={labelCls}>Nombre</label>
              <input name="nombre" required className={inputCls} placeholder="Barbería" />
            </div>
            <div>
              <label className={labelCls}>Descripción (opcional)</label>
              <input name="descripcion" className={inputCls} />
            </div>
          </div>
        </ActionForm>
      </Card>

      {/* Grid de plantillas */}
      <div className="grid gap-4 md:grid-cols-2">
        {(rubros ?? []).map((r) => {
          const campos = camposDelNegocio(r.nombre, r.template);
          const negociosCount = negociosPorRubro.get(r.id) ?? 0;
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-line bg-surface p-5 shadow-card"
            >
              <div className="flex items-start justify-between">
                <span className="flex items-center gap-3">
                  <RubroTile rubroNombre={r.nombre} size="md" />
                  <span className="leading-tight">
                    <span className="block text-[16px] font-bold text-ink">
                      {r.nombre}
                    </span>
                    <span className="block text-[13px] text-ink-soft">
                      {negociosCount} {negociosCount === 1 ? "negocio" : "negocios"}
                    </span>
                  </span>
                </span>
                <Pill tone={r.es_demo ? "success" : "neutral"}>
                  {r.es_demo ? "Publicado" : "Borrador"}
                </Pill>
              </div>

              <p className="mt-4 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-soft">
                Campos del negocio
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {campos.map((campo) => (
                  <span
                    key={campo}
                    className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-mid"
                  >
                    {campo}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5 text-sm">
                <span className="text-ink-mid">
                  Citas:{" "}
                  <strong className="text-ink">{tipoCitas(r.nombre, r.template)}</strong>
                </span>
                <span className="flex items-center gap-3">
                  <Link
                    href={`/backoffice/rubros/${r.id}`}
                    className="font-bold text-primary hover:underline"
                  >
                    Editar plantilla
                  </Link>
                  <form action={eliminarRubro}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="text-xs font-semibold text-warn-ink hover:underline"
                    >
                      Eliminar
                    </button>
                  </form>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
