/**
 * Seed de Supabase (`pnpm seed:supabase`).
 *
 * Crea los datos de demostración a partir de la config de código:
 *   1. Usuario demo (dueño del negocio de ejemplo, rol invitado).
 *   2. Rubro "estetica" con la plantilla de Estética Bella (es_demo).
 *   3. Negocio "demo-estetica" (es_demo) — el que usa /demo y su chat.
 *
 * Opcional: crear el primer administrador del back office:
 *   pnpm seed:supabase --admin correo@dominio.com contraseña123
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * Es idempotente: puede correrse varias veces (hace upsert).
 */

import { randomUUID } from "node:crypto";
import { loadEnvLocal } from "./load-env";
import { esteticaBella } from "@/businesses/estetica-bella/config";
import { RUBROS_BASE } from "@/businesses/rubros";
import { parseBusinessConfig } from "@/core/config-schema";

const DEMO_EMAIL = "demo@demo.local";
const RUBRO_SLUG = "estetica";
const NEGOCIO_SLUG = "demo-estetica";

async function main() {
  loadEnvLocal();

  // Import dinámico tras cargar el env (el cliente cachea las credenciales).
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  if (!admin) {
    console.error(
      "❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
    process.exit(1);
  }

  // ── 1. Usuario demo ────────────────────────────────────────────────────────
  let demoUserId: string | null = null;
  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw listError;
  const existing = usersPage.users.find((u) => u.email === DEMO_EMAIL);

  if (existing) {
    demoUserId = existing.id;
    console.log(`✔ Usuario demo ya existe (${DEMO_EMAIL})`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: randomUUID(), // nadie inicia sesión con él
      email_confirm: true,
    });
    if (error) throw error;
    demoUserId = data.user.id;
    console.log(`✔ Usuario demo creado (${DEMO_EMAIL})`);
  }

  await admin.from("profiles").update({ role: "invitado" }).eq("id", demoUserId);

  // ── 2. Rubros base (T-40): belleza, peluquería, masajes y restaurante ─────
  // Cada plantilla pasa por el schema antes de guardarse (regla 5 de
  // AGENTS.md). Solo "estetica" es demo (visible sin sesión en /demo).
  let rubroDemoId: string | undefined;
  for (const base of RUBROS_BASE) {
    const plantilla = parseBusinessConfig(JSON.parse(JSON.stringify(base.template)));
    if (!plantilla) throw new Error(`La plantilla del rubro "${base.slug}" no pasa el schema`);
    const { data: rubro, error: rubroError } = await admin
      .from("rubros")
      .upsert(
        {
          slug: base.slug,
          nombre: base.nombre,
          descripcion: base.descripcion,
          template: plantilla,
          es_demo: base.slug === RUBRO_SLUG,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (rubroError) throw rubroError;
    if (base.slug === RUBRO_SLUG) rubroDemoId = rubro.id;
    console.log(`✔ Rubro "${base.slug}" listo`);
  }
  if (!rubroDemoId) throw new Error(`Falta el rubro demo "${RUBRO_SLUG}" en RUBROS_BASE`);

  // El negocio demo usa la config completa de Estética Bella (bot activo,
  // dirección, horarios), no la plantilla vacía del rubro.
  const template = parseBusinessConfig(JSON.parse(JSON.stringify(esteticaBella)));
  if (!template) throw new Error("La config de estética bella no pasa el schema");
  const rubro = { id: rubroDemoId };

  // ── 3. Negocio de demostración ─────────────────────────────────────────────
  const demoConfig = {
    ...template,
    slug: NEGOCIO_SLUG,
    name: "Estética Bella (Demo)",
  };
  const { error: negocioError } = await admin.from("negocios").upsert(
    {
      owner_id: demoUserId,
      rubro_id: rubro.id,
      slug: NEGOCIO_SLUG,
      config: demoConfig,
      es_demo: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  );
  if (negocioError) throw negocioError;
  console.log(`✔ Negocio "${NEGOCIO_SLUG}" listo`);

  // ── 4. Admin opcional (--admin email password) ─────────────────────────────
  const args = process.argv.slice(2);
  const adminIdx = args.indexOf("--admin");
  if (adminIdx >= 0) {
    const email = args[adminIdx + 1];
    const password = args[adminIdx + 2];
    if (!email || !password) {
      console.error("❌ Uso: pnpm seed:supabase --admin correo contraseña");
      process.exit(1);
    }
    const already = usersPage.users.find((u) => u.email === email);
    let adminId = already?.id ?? null;
    if (!adminId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      adminId = data.user.id;
    }
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminId);
    console.log(`✔ Administrador listo (${email})`);
  }

  console.log("\n🌱 Seed completado. Visita /demo para verlo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
