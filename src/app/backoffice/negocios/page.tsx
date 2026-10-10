/**
 * Back office · Negocios: stats de la plataforma + alta + tabla global.
 */

import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { parseBusinessConfig } from "@/core/config-schema";
import { DataTable } from "@/components/data-table";
import { Card, Pill, StatCard } from "@/components/ui";
import { RubroTile, camposDelNegocio } from "@/components/rubro-visual";
import { mesDeUso } from "@/core/storage/whatsapp-usage-repository";
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

  const [{ data: negocios }, { data: clientes }, { data: rubros }, leadsRes, leadsHoyRes, usoRes] =
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
      // T-43: mensajes de WhatsApp del mes en curso. Sin la migración 0021
      // la consulta falla y la columna muestra "—" en vez de romper la página.
      supabase
        .from("uso_whatsapp")
        .select("negocio_id, recibidos, enviados, plantillas")
        .eq("mes", mesDeUso(new Date())),
    ]);

  const rows = (negocios ?? []) as unknown as NegocioRow[];
  const leadsPorNegocio = new Map<string, number>();
  for (const l of leadsRes.data ?? []) {
    leadsPorNegocio.set(
      l.business_slug,
      (leadsPorNegocio.get(l.business_slug) ?? 0) + 1,
    );
  }

  const usoPorNegocio = new Map(
    (usoRes.data ?? []).map((u) => [u.negocio_id as string, u as { recibidos: number; enviados: number; plantillas: number }]),
  );
  const mensajesMes = (usoRes.data ?? []).reduce((t, u) => t + u.enviados + u.plantillas, 0);

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Negocios activos" value={String(activos)} />
        <StatCard label="Clientes" value={String(clientes?.length ?? 0)} />
        <StatCard label="Rubros" value={String(rubros?.length ?? 0)} />
        <StatCard label="Leads hoy" value={String(leadsHoyRes.count ?? 0)} />
        <StatCard label="WhatsApp enviados (mes)" value={usoRes.error ? "—" : String(mensajesMes)} />
      </div>

      <Card
        title="Nuevo negocio"
        subtitle="Elegí el cliente dueño y el rubro que le da su plantilla base. Nace en pausa."
      >
        <NuevoNegocioForm rubros={rubroOptions} clientes={clienteOptions} />
      </Card>

      <DataTable
        headers={["Negocio", "Rubro", "Cliente", "Estado", "Leads", "WhatsApp (mes)", "Plan"]}
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
            <UsoWhatsapp key="w" uso={usoPorNegocio.get(row.id)} sinTabla={Boolean(usoRes.error)} />,
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

/**
 * T-43: enviados (texto libre) + plantillas, que son las que Meta cobra
 * siempre; los recibidos van aparte porque son gratis pero abren la
 * ventana de 24h en la que responder no cuesta.
 */
function UsoWhatsapp({
  uso,
  sinTabla,
}: {
  uso?: { recibidos: number; enviados: number; plantillas: number };
  sinTabla: boolean;
}) {
  if (sinTabla) return <span className="text-ink-soft">—</span>;
  return (
    <span className="text-ink-mid" title="Enviados · plantillas · recibidos este mes">
      <span className="font-display font-bold text-ink">{(uso?.enviados ?? 0) + (uso?.plantillas ?? 0)}</span>
      {" "}
      <span className="text-xs">
        ({uso?.plantillas ?? 0} plant. · {uso?.recibidos ?? 0} recib.)
      </span>
    </span>
  );
}
