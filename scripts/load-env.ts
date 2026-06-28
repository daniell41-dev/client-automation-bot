/**
 * Carga simple de variables desde .env.local para scripts de consola.
 *
 * tsx no inyecta .env.local automáticamente, así que lo leemos a mano. Las
 * variables ya presentes en el entorno tienen prioridad (no se sobreescriben).
 */

import { readFileSync } from "node:fs";

export function loadEnvLocal(path = ".env.local"): void {
  try {
    const raw = readFileSync(path, "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) process.env[m[1].trim()] ??= m[2].trim();
    }
  } catch {
    /* .env.local no existe: continuar sin ella */
  }
}
