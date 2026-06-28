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
    // split por \r?\n para tolerar CRLF (Windows) además de LF (Unix).
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) process.env[m[1].trim()] ??= m[2].trim();
    }
  } catch {
    /* .env.local no existe: continuar sin ella */
  }
}
