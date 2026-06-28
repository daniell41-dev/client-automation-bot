/**
 * Diagnóstico de Google Sheets (`pnpm sheets:doctor`).
 *
 * Verifica de punta a punta que la integración con Sheets funciona para un
 * negocio específico:
 *   1. ¿Están las credenciales globales (service account)?
 *   2. ¿El negocio tiene spreadsheetId configurado?
 *   3. ¿La auth conecta? (lee la planilla)
 *   4. ¿Puede crear pestañas y escribir? (ensureSheet + append)
 *   5. ¿Puede leer lo que escribió? (read-back + limpieza automática)
 *   6. ¿La pestaña Sesiones también responde?
 *
 * Uso:
 *   pnpm sheets:doctor
 *   pnpm sheets:doctor --business estetica-bella
 */

import { loadEnvLocal } from "./load-env";
import { serviceAccountFromEnv, createSheetsApi } from "@/core/storage/adapters/google/auth";
import { getBusinessBySlug } from "@/businesses/registry";

const TEST_ID = "__sheets_doctor_test__";

const LEADS_HEADERS = [
  "id", "businessSlug", "channel", "contact", "name", "serviceId",
  "tentativeDate", "state", "stage", "createdAt", "updatedAt",
  "lastInboundAt", "followUpsSent", "notes",
];

const SESIONES_HEADERS = [
  "businessSlug", "contact", "channel", "updatedAt", "history",
];

function parseArgs(): string {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === "--business" || a === "-b");
  return idx >= 0 ? (args[idx + 1] ?? "estetica-bella") : "estetica-bella";
}

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function extractStatus(err: unknown): number | undefined {
  const e = err as Record<string, unknown>;
  const status =
    (e["status"] as number | undefined) ??
    (e["code"] as number | undefined) ??
    ((e["response"] as Record<string, unknown> | undefined)?.["status"] as number | undefined);
  return typeof status === "number" ? status : undefined;
}

async function main() {
  loadEnvLocal();

  const slug = parseArgs();
  console.log(`\n🩺 Diagnóstico de Google Sheets — negocio: ${slug}\n`);

  // Paso 1: credenciales globales de la service account.
  const creds = serviceAccountFromEnv();
  if (!creds) {
    const missing: string[] = [];
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    if (!process.env.GOOGLE_PRIVATE_KEY)           missing.push("GOOGLE_PRIVATE_KEY");
    fail(
      `Faltan credenciales globales en .env.local:\n` +
      missing.map((v) => `   • ${v}`).join("\n") + "\n\n" +
      `   Seguí la guía en docs/07-google-sheets.md`,
    );
  }

  console.log(`✅ Paso 1: Credenciales de service account detectadas`);
  console.log(`   Service Account: ${creds.email.split("@")[0]}@...\n`);

  // Paso 2: spreadsheetId del negocio.
  const business = getBusinessBySlug(slug);
  if (!business) {
    fail(`Negocio "${slug}" no encontrado. Registralo en src/businesses/registry.ts`);
  }

  const spreadsheetId =
    business.storage?.spreadsheetId ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    fail(
      `El negocio "${slug}" no tiene spreadsheetId configurado.\n` +
      `   Agregá storage: { spreadsheetId: "<ID>" } en src/businesses/${slug}/config.ts\n` +
      `   O configurá GOOGLE_SHEETS_SPREADSHEET_ID en .env.local como fallback.`,
    );
  }

  const idSource = business.storage?.spreadsheetId
    ? "config del negocio"
    : "variable de entorno (fallback)";

  console.log(`✅ Paso 2: Spreadsheet ID detectado (${idSource})`);
  console.log(`   ID: ${spreadsheetId.slice(0, 10)}...\n`);

  // Paso 3: autenticación + lectura básica.
  const sheets = createSheetsApi(spreadsheetId)!;

  try {
    await sheets.getValues("A1:A1");
    console.log(`✅ Paso 3: Conexión y autenticación OK\n`);
  } catch (err) {
    const status = extractStatus(err);
    const e = err as { message?: string };
    if (status === 403) {
      fail(
        `403 Forbidden — la hoja NO está compartida con la cuenta de servicio.\n` +
        `   1. Abrí la planilla en Google Sheets.\n` +
        `   2. Botón "Compartir" → agregá: ${creds.email}\n` +
        `   3. Rol: Editor → Listo.`,
      );
    }
    if (status === 404) {
      fail(
        `404 Not Found — spreadsheetId incorrecto para "${slug}".\n` +
        `   Buscá el ID en la URL:\n` +
        `   https://docs.google.com/spreadsheets/d/<ESTE_ID>/edit`,
      );
    }
    fail(`Falló la conexión (status ${status ?? "?"}): ${e.message ?? err}`);
  }

  // Paso 4: ensureSheet + escritura de fila de prueba.
  try {
    await sheets.ensureSheet("Leads", LEADS_HEADERS);
    const now = new Date().toISOString();
    await sheets.appendValues("Leads!A2:N", [[
      TEST_ID, slug, "mock", "0000000000", "Doctor Test",
      "", "", "new", "greeting", now, now, now, "[]", "fila de prueba — borrable",
    ]]);
    console.log(`✅ Paso 4: Escritura OK — fila de prueba agregada a "Leads"\n`);
  } catch (err) {
    const e = err as { message?: string };
    fail(`Falló la escritura en "Leads": ${e.message ?? err}`);
  }

  // Paso 5: lectura de verificación + limpieza.
  try {
    const rows = await sheets.getValues("Leads!A2:N");
    const idx  = rows.findIndex((r) => r[0] === TEST_ID);
    if (idx < 0) {
      fail(`La fila fue escrita pero no se encontró al leer. Revisá los permisos de la hoja.`);
    }
    console.log(`✅ Paso 5: Lectura de verificación OK — fila encontrada en la fila ${idx + 2}\n`);

    const rowNum = idx + 2;
    await sheets.updateValues(`Leads!A${rowNum}:N${rowNum}`, [Array<string>(14).fill("")]);
    console.log(`🧹 Fila de prueba limpiada (fila ${rowNum} vaciada)\n`);
  } catch (err) {
    const e = err as { message?: string };
    fail(`Falló la lectura/limpieza: ${e.message ?? err}`);
  }

  // Paso 6: pestaña Sesiones.
  try {
    await sheets.ensureSheet("Sesiones", SESIONES_HEADERS);
    console.log(`✅ Paso 6: Pestaña "Sesiones" OK\n`);
  } catch (err) {
    const e = err as { message?: string };
    fail(`Falló la verificación de "Sesiones": ${e.message ?? err}`);
  }

  console.log(`🎉 Todo funciona. La planilla de "${slug}" está correctamente configurada.\n`);
  console.log(`   Las pestañas "Leads" y "Sesiones" ya existen con sus encabezados.`);
  console.log(`   Podés verlas en:`);
  console.log(`   https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
