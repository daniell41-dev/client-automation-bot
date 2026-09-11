/**
 * Back office · Negocios: stats de la plataforma + alta + tabla global.
 */

import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { DataTable } from "@/components/data-table";
import { Card, Pill, StatCard } from "@/components/ui";
import { RubroTile, camposDelNegocio } from "@/components/rubro-visual";
import { NuevoNegocioForm } from "./nuevo-negocio-form";

export const dynamic = "force-dynamic";

interface NegocioRow {
  id: string;
  slug: string;
  config: unknown;
  whatsapp_phone_number_id: string | null;
  profiles: { email: string } | null;
  rubros: { nombre: string } | null;
}

export default async function NegociosPage() {
  const supabase = await createUserClient();

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [{ data: negocios }, { data: clientes }, { data: rubros }, leadsRes, leadsHoyRes] =
    await Promise.all([
      supabase
        .from("negocios")
        .select("id, slug, config, whatsapp_phone_number_id, profiles(email), rubros(nombre)")
        .order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, email").eq("role", "cliente"),
      // Con template (no solo el count): alimenta el select + el preview
      // en vivo de "Nuevo negocio" — ver camposDelNegocio() más abajo.
      supabase.from("rubros").select("id, nombre, template").order("nombre"),
      supabase.from("leads").select("business_slug"),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", hoy.toISOString()),
    ]);

  const rows = (negocios ?? []) as unknown as NegocioRow[];
  const leadsPorNegocio = new Map<string, number>();
  for (const l of leadsRes.data ?? []) {
    leadsPorNegocio.set(
      l.business_slug,
      (leadsPorNegocio.get(l.business_slug) ?? 0) + 1,
    );
  }

  const parsed = rows.map((n) => ({
    row: n,
    config: parseBusinessConfig(n.config),
  }));
  const activos = parsed.filter(({ config }) => config?.botActivo !== false).length;

  const rubroOptions = (rubros ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    campos: camposDelNegocio(r.nombre, r.template),
  }));
  const clienteOptions = (clientes ?? []).map((c) => ({ id: c.id, email: c.email }));

  return (
    <div className="mx-auto max-w-[980px] space-y-5 fade-up">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Negocios activos" value={String(activos)} />
        <StatCard label="Clientes" value={String(clientes?.length ?? 0)} />
        <StatCard label="Rubros" value={String(rubros?.length ?? 0)} />
        <StatCard label="Leads hoy" value={String(leadsHoyRes.count ?? 0)} />
      </div>

      <Card
        title="Nuevo negocio"
        subtitle="Elegí el cliente dueño y el rubro que le da su plantilla base. Nace en pausa."
      >
        <NuevoNegocioForm rubros={rubroOptions} clientes={clienteOptions} />
      </Card>

      <DataTable
        headers={["Negocio", "Rubro", "Cliente", "Estado", "Leads", "Plan"]}
        emptyText="Todavía no hay negocios creados."
        rows={parsed.map(({ row, config }) => ({
          key: row.id,
          cells: [
            <Link
              key="n"
              href={`/backoffice/negocios/${row.id}`}
              className="flex items-center gap-2.5 hover:underline"
            >
              <RubroTile rubroNombre={row.rubros?.nombre} size="sm" />
              <span className="max-w-[160px] truncate font-bold text-ink">
                {config?.name ?? row.slug}
              </span>
            </Link>,
            <span key="r" className="text-ink-mid">
              {row.rubros?.nombre ?? "—"}
            </span>,
            <span key="c" className="text-ink-mid">
              {row.profiles?.email ?? "—"}
            </span>,
            <Pill key="e" tone={config?.botActivo !== false ? "success" : "warn"} dot>
              {config?.botActivo !== false ? "Activo" : "Pausado"}
            </Pill>,
            <span key="l" className="font-display font-bold text-ink">
              {leadsPorNegocio.get(row.slug) ?? 0}
            </span>,
            <Pill key="p" tone={config?.plan === "pro" ? "info" : "neutral"}>
              {config?.plan === "pro" ? "Pro" : "Free"}
            </Pill>,
          ],
        }))}
      />

      <p className="text-xs text-ink-soft">
        Hacé clic en un negocio para editarlo, pausarlo/activarlo o eliminarlo.
      </p>
    </div>
  );
}
