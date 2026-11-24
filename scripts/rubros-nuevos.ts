/**
 * T-110: crea en Supabase los rubros de `RUBROS_BASE` que todavía no
 * existen (hoy: "Ropa / Mayorista"). No se usa `seed:supabase` porque ese
 * script también toca el usuario y el negocio demo, y pisa las plantillas de
 * los rubros ya creados, que se pueden haber editado en el back office. Este
 * solo INSERTA lo que falta y nunca modifica un rubro existente.
 *
 * Uso:
 *   pnpm rubros:nuevos             # dry-run: dice qué crearía
 *   pnpm rubros:nuevos --aplicar   # los crea de verdad
 *
 * Cada plantilla pasa por `businessConfigSchema` antes de escribir (regla 5).
 */

import { loadEnvLocal } from "./load-env";
import { RUBROS_BASE } from "@/businesses/rubros";
import { parseBusinessConfig } from "@/core/config-schema";

async function main() {
  loadEnvLocal();
  const aplicar = process.argv.includes("--aplicar");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  if (!admin) {
    console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  const { data: existentes, error } = await admin.from("rubros").select("slug");
  if (error) {
    console.error(`❌ No se pudo leer "rubros": ${error.message}`);
    process.exit(1);
  }
  const yaEstan = new Set((existentes ?? []).map((r) => r.slug as string));
  const faltan = RUBROS_BASE.filter((r) => !yaEstan.has(r.slug));

  console.log(`\n🏷️  Rubros nuevos ${aplicar ? "(ESCRIBIENDO)" : "(dry-run, no escribe nada)"}\n`);
  if (faltan.length === 0) {
    console.log("✔ No falta ninguno.");
    return;
  }

  for (const base of faltan) {
    const plantilla = parseBusinessConfig(JSON.parse(JSON.stringify(base.template)));
    if (!plantilla) {
      console.error(`❌ La plantilla de "${base.slug}" no pasa el schema; no se crea.`);
      process.exitCode = 1;
      continue;
    }
    if (!aplicar) {
      console.log(`→ Crearía "${base.nombre}" (${base.slug})`);
      continue;
    }
    const { error: errorInsert } = await admin.from("rubros").insert({
      slug: base.slug,
      nombre: base.nombre,
      descripcion: base.descripcion,
      template: plantilla,
      es_demo: false,
    });
    if (errorInsert) {
      console.error(`❌ "${base.slug}": ${errorInsert.message}`);
      process.exitCode = 1;
    } else {
      console.log(`✔ Creado "${base.nombre}" (${base.slug})`);
    }
  }
  if (!aplicar) console.log("\nPara crearlos: pnpm rubros:nuevos --aplicar");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
