/**
 * Los tests de integración (`rls.test.ts`, `cascade.test.ts`) comparten la
 * MISMA base descartable de `TEST_DATABASE_URL`, y cada uno hace drop/create
 * del schema `public` en su `beforeAll`/`afterAll`. Vitest corre los archivos
 * de test en paralelo por defecto, así que sin este lock las dos suites se
 * pisan el schema al mismo tiempo y revientan con errores de Postgres que no
 * tienen nada que ver con RLS ni con el backfill (visto corriendo `pnpm test`
 * con `TEST_DATABASE_URL` seteada: `duplicate key value violates unique
 * constraint "pg_namespace_nspname_index"` / `schema "public" does not
 * exist"`, según quién ganaba la carrera).
 *
 * Un advisory lock de sesión en Postgres serializa ambas suites entre sí sin
 * tocar el paralelismo de Vitest para el resto del repo (unit tests, sin
 * Postgres de por medio).
 */

import { Client } from "pg";

const LOCK_KEY = 727_001; // arbitrario — solo importa que ambos archivos usen el mismo

/**
 * Bloquea hasta obtener el lock (si la otra suite lo tiene, espera) y
 * devuelve la función que lo libera. La conexión que toma el lock se
 * mantiene abierta a propósito: un advisory lock de sesión se libera solo si
 * se llama `pg_advisory_unlock` o se cierra la conexión que lo tomó.
 */
export async function acquireScratchDbLock(
  connectionString: string | undefined,
): Promise<() => Promise<void>> {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  return async () => {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
    await client.end();
  };
}
