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
      if (m) {
        let value = m[2].trim();
        // Stripear comillas envolventes (comportamiento estándar de dotenv).
        // Acepta comilla de apertura sin cierre (p.ej. clave PEM que termina en \n literal).
        if (value.startsWith('"') || value.startsWith("'")) {
          const quote = value[0];
          value = value.endsWith(quote) ? value.slice(1, -1) : value.slice(1);
        }
        process.env[m[1].trim()] ??= value;
      }
    }
  } catch {
    /* .env.local no existe: continuar sin ella */
  }
}
