/**
 * T-78: pasa a usted los textos de `rubros.template` y `negocios.config` que
 * ya están guardados en Supabase. El código nuevo ya no tiene voseo, pero lo
 * que se sembró antes (y lo que cada dueña copió de la plantilla) sigue en
 * la base. No se hace con una migración SQL porque hay que validar cada
 * config con `businessConfigSchema` antes de escribir (regla 5 de AGENTS.md),
 * y eso solo existe en TypeScript.
 *
 * Uso:
 *   pnpm quitar:voseo              # dry-run: solo muestra el diff, no escribe
 *   pnpm quitar:voseo --aplicar    # escribe de verdad
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * Dry-run por defecto (al revés que `migrar-horarios.ts`): este script
 * reescribe textos que escribió una persona, así que primero hay que leer el
 * diff y solo después aplicarlo.
 */

import { loadEnvLocal } from "./load-env";
import { parseBusinessConfig } from "@/core/config-schema";
import { quitarVoseoConfig } from "./quitar-voseo-lib";

interface TablaARevisar {
  tabla: "negocios" | "rubros";
  columnaJson: "config" | "template";
}

const TABLAS: TablaARevisar[] = [
  { tabla: "rubros", columnaJson: "template" },
  { tabla: "negocios", columnaJson: "config" },
];

/** Un texto en una línea, para que el diff se lea en la terminal. */
function enUnaLinea(texto: string): string {
  return texto.replace(/\n/g, "⏎");
}

async function main() {
  loadEnvLocal();
  const aplicar = process.argv.includes("--aplicar");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  if (!admin) {
    console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  console.log(`\n🗣️  Quitar voseo ${aplicar ? "(ESCRIBIENDO)" : "(dry-run, no escribe nada)"}\n`);

  let conCambios = 0;
  let invalidos = 0;
  let sinCambios = 0;

  for (const { tabla, columnaJson } of TABLAS) {
    const { data: filas, error } = await admin.from(tabla).select(`id, slug, ${columnaJson}`);
    if (error) {
      console.error(`❌ No se pudo leer "${tabla}": ${error.message}`);
      process.exit(1);
    }

    for (const fila of filas ?? []) {
      const raw = (fila as Record<string, unknown>)[columnaJson];
      if (!raw || typeof raw !== "object") {
        sinCambios++;
        continue;
      }
      const { config, cambios } = quitarVoseoConfig(raw as Record<string, unknown>);
      if (cambios.length === 0) {
        sinCambios++;
        continue;
      }

      console.log(`── ${tabla}/${fila.slug} (${cambios.length} cambio${cambios.length === 1 ? "" : "s"})`);
      for (const c of cambios) {
        console.log(`   ${c.campo}`);
        console.log(`   - ${enUnaLinea(c.antes)}`);
        console.log(`   + ${enUnaLinea(c.despues)}`);
      }

      // Regla 5: nada se escribe sin pasar por el schema. Si la fila ya no
      // pasaba antes (dato viejo roto), se reporta y se deja para arreglar a
      // mano: este script cambia textos, no repara configs.
      if (!parseBusinessConfig(config)) {
        invalidos++;
        console.log("   ⚠️  El resultado no pasa businessConfigSchema: NO se escribe. Revisar a mano.\n");
        continue;
      }
      conCambios++;

      if (aplicar) {
        const { error: updateError } = await admin
          .from(tabla)
          .update({ [columnaJson]: config })
          .eq("id", fila.id);
        console.log(updateError ? `   ❌ No se pudo guardar: ${updateError.message}\n` : "   ✅ Guardado\n");
      } else {
        console.log("");
      }
    }
  }

  console.log(
    `${conCambios} con cambios, ${invalidos} sin escribir por no pasar el schema, ${sinCambios} sin nada que cambiar.`,
  );
  if (!aplicar && conCambios > 0) {
    console.log("Revise el diff y, si está bien, ejecute: pnpm quitar:voseo --aplicar\n");
  }
  if (invalidos > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
