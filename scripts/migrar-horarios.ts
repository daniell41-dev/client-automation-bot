/**
 * Migra `config.horarios`/`template.horarios` del formato viejo (día en
 * texto libre) al nuevo de T-20 (`dow` numérico + tramos), en `negocios` y
 * `rubros`.
 *
 * Uso:
 *   pnpm exec tsx scripts/migrar-horarios.ts --dry-run   # solo reporta
 *   pnpm exec tsx scripts/migrar-horarios.ts             # escribe de verdad
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * Conservador: si una fila trae un día que no reconoce, NO la toca — la
 * imprime en la lista de "no convertidos" para arreglarla a mano en vez de
 * adivinar en silencio.
 */

import { loadEnvLocal } from "./load-env";
import { parseBusinessConfig } from "@/core/config-schema";
import { convertirHorarios, esFormatoViejo } from "./migrar-horarios-lib";

interface TablaAMigrar {
  tabla: "negocios" | "rubros";
  columnaJson: "config" | "template";
}

const TABLAS: TablaAMigrar[] = [
  { tabla: "negocios", columnaJson: "config" },
  { tabla: "rubros", columnaJson: "template" },
];

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  if (!admin) {
    console.error(
      "❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
    process.exit(1);
  }

  console.log(`\n🕐 Migración de horarios ${dryRun ? "(dry-run, no escribe nada)" : "(escribiendo)"}\n`);

  let convertidos = 0;
  let sinConvertir = 0;
  let sinTocar = 0;

  for (const { tabla, columnaJson } of TABLAS) {
    const { data: filas, error } = await admin.from(tabla).select(`id, slug, ${columnaJson}`);
    if (error) {
      console.error(`❌ No se pudo leer "${tabla}": ${error.message}`);
      process.exit(1);
    }

    for (const fila of filas ?? []) {
      const raw = (fila as Record<string, unknown>)[columnaJson];
      const config = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      const horarios = config?.horarios;

      if (!esFormatoViejo(horarios)) {
        sinTocar++;
        continue;
      }

      const resultado = convertirHorarios(horarios);
      if (!resultado.ok) {
        sinConvertir++;
        console.log(
          `⚠️  ${tabla}/${fila.slug}: no se pudo convertir — días desconocidos: ${resultado.noConvertidos.join(", ")}`,
        );
        continue;
      }

      const nuevoConfig = { ...config, horarios: resultado.horarios };
      const validado = parseBusinessConfig(nuevoConfig);
      if (!validado) {
        sinConvertir++;
        console.log(`⚠️  ${tabla}/${fila.slug}: convertido pero no pasa el schema — revisar a mano.`);
        continue;
      }

      convertidos++;
      console.log(
        `✅ ${tabla}/${fila.slug}: ${horarios.length} entrada(s) vieja(s) → ${resultado.horarios.length} fila(s) nuevas.`,
      );

      if (!dryRun) {
        const { error: updateError } = await admin
          .from(tabla)
          .update({ [columnaJson]: nuevoConfig })
          .eq("id", fila.id);
        if (updateError) {
          console.error(`   ❌ No se pudo guardar: ${updateError.message}`);
        }
      }
    }
  }

  console.log(
    `\n${convertidos} convertidos, ${sinConvertir} sin convertir (revisar a mano), ${sinTocar} sin horarios en formato viejo (nada que hacer).`,
  );
  if (dryRun && convertidos > 0) {
    console.log("Corré sin --dry-run para aplicar los cambios de verdad.\n");
  }
  if (sinConvertir > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
