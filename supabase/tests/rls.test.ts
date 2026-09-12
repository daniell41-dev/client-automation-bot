/**
 * Test de integración de Row Level Security: dos clientes, cada uno con un
 * rubro asignado, contra las políticas REALES de `supabase/migrations/`.
 *
 * Corre las migraciones (0001 → 0002 → 0003) tal cual se aplicarían en
 * Supabase, con un shim mínimo de `auth` (ver `00-auth-shim.sql`) para poder
 * simular `auth.uid()` sin levantar el stack completo. Sin esto, un bug como
 * el de T-03 (columnas sin calificar que Postgres resuelve contra la tabla
 * equivocada) es indetectable leyendo el SQL: hay que ejecutarlo.
 *
 * Requiere `TEST_DATABASE_URL` apuntando a una base DESCARTABLE (se borra y
 * recrea el schema `public`/`auth` en cada corrida). Sin esa variable el
 * test se salta — `pnpm test` sigue verde en cualquier máquina sin Postgres.
 * Ver docs/06-testing-guide.md para cómo levantar una base de prueba.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { loadEnvLocal } from "../../scripts/load-env";
import { acquireScratchDbLock } from "./scratch-db-lock";

loadEnvLocal();

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function readSql(dir: string, file: string): string {
  return readFileSync(join(dir, file), "utf-8");
}

/** Corre SQL como dueño de las tablas (bypassa RLS) — setup, seed y DDL. */
async function adminQuery(sql: string, params?: unknown[]): Promise<void> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql, params as unknown[]);
  } finally {
    await client.end();
  }
}

/**
 * Corre una query CON RLS activo, como la correría PostgREST autenticado con
 * el JWT de `userId` (o como `anon` si `userId` es `null`). Conexión nueva
 * por llamada a propósito: el rol y el GUC del JWT son de sesión, y así no
 * se arrastran de una llamada a la siguiente.
 */
async function queryAs<T extends Record<string, unknown> = Record<string, unknown>>(
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(`set role ${userId ? "authenticated" : "anon"}`);
    if (userId) {
      await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    }
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

const CLIENTE_A = randomUUID();
const CLIENTE_B = randomUUID();
const RUBRO_A = randomUUID();
const RUBRO_B = randomUUID();

describe.skipIf(!TEST_DATABASE_URL)("RLS: rubros y negocios (supabase/migrations)", () => {
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    // Serializa contra cascade.test.ts: comparten la misma base descartable
    // (ver scratch-db-lock.ts).
    releaseLock = await acquireScratchDbLock(TEST_DATABASE_URL);

    // Base desechable: recrea `public`/`auth` desde cero en cada corrida.
    await adminQuery(`
      drop schema if exists public cascade;
      drop schema if exists auth cascade;
      create schema public;
    `);
    await adminQuery(readSql(__dirname, "00-auth-shim.sql"));
    await adminQuery(readSql(MIGRATIONS_DIR, "0001_schema_inicial.sql"));
    await adminQuery(readSql(MIGRATIONS_DIR, "0002_sesiones_cliente.sql"));
    await adminQuery(readSql(MIGRATIONS_DIR, "0003_fix_rls.sql"));
    await adminQuery(readSql(__dirname, "01-grants.sql"));

    // Dos clientes; cada uno con SOLO su propio rubro asignado.
    await adminQuery(
      `insert into auth.users (id, email) values ($1, 'a@test.local'), ($2, 'b@test.local')`,
      [CLIENTE_A, CLIENTE_B],
    );
    await adminQuery(
      `insert into public.rubros (id, slug, nombre, template) values
         ($1, 'rls-rubro-a', 'Rubro A', '{}'::jsonb),
         ($2, 'rls-rubro-b', 'Rubro B', '{}'::jsonb)`,
      [RUBRO_A, RUBRO_B],
    );
    await adminQuery(
      `insert into public.asignaciones (user_id, rubro_id) values ($1, $2), ($3, $4)`,
      [CLIENTE_A, RUBRO_A, CLIENTE_B, RUBRO_B],
    );
  });

  afterAll(async () => {
    await adminQuery(`
      drop schema if exists public cascade;
      drop schema if exists auth cascade;
    `);
    await releaseLock();
  });

  it("el cliente A lee el rubro que tiene asignado (antes de 0003: 0 filas)", async () => {
    const rows = await queryAs(CLIENTE_A, "select id from public.rubros where id = $1", [RUBRO_A]);
    expect(rows).toHaveLength(1);
  });

  it("el cliente A NO ve el rubro asignado solo a B", async () => {
    const rows = await queryAs(CLIENTE_A, "select id from public.rubros where id = $1", [RUBRO_B]);
    expect(rows).toHaveLength(0);
  });

  it("el cliente A NO puede crear un negocio en el rubro de B (antes de 0003: sí podía)", async () => {
    await expect(
      queryAs(
        CLIENTE_A,
        `insert into public.negocios (owner_id, rubro_id, slug, config) values ($1, $2, $3, '{}'::jsonb)`,
        [CLIENTE_A, RUBRO_B, `robado-${randomUUID()}`],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("el cliente A SÍ puede crear un negocio en su propio rubro (el fix no rompe el caso legítimo)", async () => {
    const slug = `propio-${randomUUID()}`;
    await queryAs(
      CLIENTE_A,
      `insert into public.negocios (owner_id, rubro_id, slug, config) values ($1, $2, $3, '{}'::jsonb)`,
      [CLIENTE_A, RUBRO_A, slug],
    );
    const rows = await queryAs(CLIENTE_A, "select id from public.negocios where slug = $1", [slug]);
    expect(rows).toHaveLength(1);
  });
});
