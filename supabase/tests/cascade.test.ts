/**
 * Test de integración de `negocio_id` como FK en `leads`/`sesiones` (T-08),
 * contra las migraciones REALES.
 *
 * Corre 0001→0005 (schema sin `negocio_id`, como en producción hoy), inserta
 * leads/sesiones solo con `business_slug` (como los escribe el bot ahora
 * mismo), y recién ahí aplica 0006 — así el backfill se prueba de verdad,
 * migrando datos que ya existían, no datos insertados después del cambio.
 *
 * Requiere `TEST_DATABASE_URL` apuntando a una base DESCARTABLE (igual
 * criterio que `rls.test.ts` — sin la variable, el test se salta).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { loadEnvLocal } from "../../scripts/load-env";

loadEnvLocal();

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function readSql(dir: string, file: string): string {
  return readFileSync(join(dir, file), "utf-8");
}

async function adminQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(sql, params as unknown[]);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

const OWNER = randomUUID();
const RUBRO = randomUUID();
const NEGOCIO_HUERFANO_SLUG = `huerfano-${randomUUID()}`;

describe.skipIf(!TEST_DATABASE_URL)("negocio_id como FK en leads/sesiones (T-08)", () => {
  let negocioId: string;

  beforeAll(async () => {
    await adminQuery(`
      drop schema if exists public cascade;
      drop schema if exists auth cascade;
      create schema public;
    `);
    await adminQuery(readSql(__dirname, "00-auth-shim.sql"));
    await adminQuery(readSql(MIGRATIONS_DIR, "0001_schema_inicial.sql"));
    await adminQuery(readSql(MIGRATIONS_DIR, "0002_sesiones_cliente.sql"));
    await adminQuery(readSql(MIGRATIONS_DIR, "0003_fix_rls.sql"));
    await adminQuery(readSql(MIGRATIONS_DIR, "0004_mensajes_procesados.sql"));
    await adminQuery(readSql(MIGRATIONS_DIR, "0005_uso_ia.sql"));

    await adminQuery(`insert into auth.users (id, email) values ($1, 'owner@test.local')`, [OWNER]);
    await adminQuery(
      `insert into public.rubros (id, slug, nombre, template) values ($1, 'cascade-rubro', 'Rubro', '{}'::jsonb)`,
      [RUBRO],
    );
    const [negocio] = await adminQuery<{ id: string }>(
      `insert into public.negocios (owner_id, rubro_id, slug, config) values ($1, $2, 'cascade-negocio', '{}'::jsonb) returning id`,
      [OWNER, RUBRO],
    );
    negocioId = negocio.id;

    // Se insertan SIN negocio_id (la columna todavía no existe) — así se
    // simula lo que ya hay en producción antes de correr 0006.
    await adminQuery(
      `insert into public.leads (id, business_slug, channel, contact, state, stage, created_at, updated_at, last_inbound_at)
       values ('lead-cascade', 'cascade-negocio', 'whatsapp', '57300', 'interesado', 'inicio', now(), now(), now())`,
    );
    await adminQuery(
      `insert into public.sesiones (business_slug, contact, channel) values ('cascade-negocio', '57300', 'whatsapp')`,
    );
    // Lead huérfano: su slug no corresponde a NINGÚN negocio real — el
    // backfill no debe inventarle un negocio_id.
    await adminQuery(
      `insert into public.leads (id, business_slug, channel, contact, state, stage, created_at, updated_at, last_inbound_at)
       values ('lead-huerfano', $1, 'whatsapp', '57301', 'interesado', 'inicio', now(), now(), now())`,
      [NEGOCIO_HUERFANO_SLUG],
    );

    await adminQuery(readSql(MIGRATIONS_DIR, "0006_negocio_id_fk.sql"));
  });

  afterAll(async () => {
    await adminQuery(`
      drop schema if exists public cascade;
      drop schema if exists auth cascade;
    `);
  });

  it("el backfill completa negocio_id de leads/sesiones existentes por su slug", async () => {
    const [lead] = await adminQuery<{ negocio_id: string }>(
      `select negocio_id from public.leads where id = 'lead-cascade'`,
    );
    expect(lead.negocio_id).toBe(negocioId);

    const [sesion] = await adminQuery<{ negocio_id: string }>(
      `select negocio_id from public.sesiones where business_slug = 'cascade-negocio'`,
    );
    expect(sesion.negocio_id).toBe(negocioId);
  });

  it("un lead cuyo slug no matchea ningún negocio queda con negocio_id null (no inventa uno)", async () => {
    const [lead] = await adminQuery<{ negocio_id: string | null }>(
      `select negocio_id from public.leads where id = 'lead-huerfano'`,
    );
    expect(lead.negocio_id).toBeNull();
  });

  it("borrar el negocio arrastra (cascade) sus leads y sesiones", async () => {
    await adminQuery(`delete from public.negocios where id = $1`, [negocioId]);

    const leads = await adminQuery(`select id from public.leads where id = 'lead-cascade'`);
    expect(leads).toHaveLength(0);

    const sesiones = await adminQuery(
      `select contact from public.sesiones where business_slug = 'cascade-negocio'`,
    );
    expect(sesiones).toHaveLength(0);

    // El lead huérfano (negocio_id null) no se ve afectado por el borrado.
    const huerfano = await adminQuery(`select id from public.leads where id = 'lead-huerfano'`);
    expect(huerfano).toHaveLength(1);
  });
});
