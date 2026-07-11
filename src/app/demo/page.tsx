/**
 * /demo — vista pública de demostración (sin login).
 *
 * Usa el cliente anónimo: RLS solo le deja leer las filas `es_demo = true`.
 * Muestra el rubro y el negocio de ejemplo, y enlaza al chat de prueba.
 */

import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/anon";
import { parseBusinessConfig } from "@/core/config-schema";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const supabase = createAnonClient();

  if (!supabase) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <p className="font-medium">Demo no disponible.</p>
          <p className="text-sm">Supabase no está configurado en este entorno.</p>
        </div>
      </main>
    );
  }

  const [{ data: rubros }, { data: negocios }] = await Promise.all([
    supabase.from("rubros").select("nombre, descripcion").eq("es_demo", true),
    supabase
      .from("negocios")
      .select("slug, config")
      .eq("es_demo", true)
      .limit(1),
  ]);

  const negocio = negocios?.[0];
  const config = negocio ? parseBusinessConfig(negocio.config) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">
          Demo del bot de WhatsApp
        </h1>
        <p className="mt-2 text-slate-600">
          Así se ve un negocio configurado en la plataforma. Puedes probar el bot
          como si fueras un cliente escribiendo por WhatsApp.
        </p>
      </header>

      {(rubros ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Rubro de ejemplo
          </h2>
          {(rubros ?? []).map((r) => (
            <div key={r.nombre} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-medium text-slate-800">{r.nombre}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {r.descripcion ?? "Plantilla vertical lista para personalizar."}
              </p>
            </div>
          ))}
        </section>
      )}

      {config ? (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Negocio de ejemplo: {config.name}
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Servicio</th>
                    <th className="px-4 py-3 font-medium">Duración</th>
                    <th className="px-4 py-3 font-medium">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {config.services.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.durationMinutes} min
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Intl.NumberFormat(config.locale ?? "es-CO", {
                          style: "currency",
                          currency: config.currency,
                          maximumFractionDigits: 0,
                        }).format(s.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="text-center">
            <Link
              href="/demo/chat"
              className="inline-block rounded-lg bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700"
            >
              Probar el bot →
            </Link>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <p className="font-medium">Aún no hay negocio de demostración.</p>
          <p className="text-sm">
            Corre el seed: <code className="rounded bg-slate-100 px-1.5 py-0.5">pnpm seed:supabase</code>
          </p>
        </div>
      )}
    </main>
  );
}
