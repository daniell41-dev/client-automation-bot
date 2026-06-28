/**
 * Diagnóstico de Google Sheets (`pnpm sheets:doctor`).
 *
 * Verifica de punta a punta que la integración con Sheets funciona:
 *   1. ¿Están las 3 variables de entorno?
 *   2. ¿La auth conecta? (lee la planilla)
 *   3. ¿Puede crear pestañas y escribir? (ensureSheet + append)
 *   4. ¿Puede leer lo que escribió? (read-back + limpieza automática)
 *   5. ¿La pestaña Sesiones también responde?
 *
 * Uso:  pnpm sheets:doctor
 */

import { loadEnvLocal } from "./load-env";
import { createSheetsApi, sheetsConfigFromEnv } from "@/core/storage/adapters/google/auth";

const TEST_ID = "__sheets_doctor_test__";

const LEADS_HEADERS = [
  "id", "businessSlug", "channel", "contact", "name", "serviceId",
  "tentativeDate", "state", "stage", "createdAt", "updatedAt",
  "lastInboundAt", "followUpsSent", "notes",
];

const SESIONES_HEADERS = [
  "businessSlug", "contact", "channel", "updatedAt", "history",
];

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
  console.log("\n🩺 Diagnóstico de Google Sheets\n");

  // Paso 1: variables de entorno.
  const config = sheetsConfigFromEnv();
  if (!config) {
    const missing: string[] = [];
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) missing.push("GOOGLE_SHEETS_SPREADSHEET_ID");
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)  missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    if (!process.env.GOOGLE_PRIVATE_KEY)            missing.push("GOOGLE_PRIVATE_KEY");
    fail(
      `Faltan variables en .env.local:\n` +
      missing.map((v) => `   • ${v}`).join("\n") + "\n\n" +
      `   Seguí la guía en docs/07-google-sheets.md`,
    );
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const email         = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;

  console.log(`✅ Paso 1: Variables detectadas`);
  console.log(`   Spreadsheet ID:  ${spreadsheetId.slice(0, 10)}...`);
  console.log(`   Service Account: ${email.split("@")[0]}@...\n`);

  // Paso 2: autenticación + lectura básica.
  const sheets = createSheetsApi()!;

  try {
    await sheets.getValues("A1:A1");
    console.log(`✅ Paso 2: Conexión y autenticación OK\n`);
  } catch (err) {
    const status = extractStatus(err);
    const e = err as { message?: string };
    if (status === 403) {
      fail(
        `403 Forbidden — la hoja NO está compartida con la cuenta de servicio.\n` +
        `   1. Abrí la planilla en Google Sheets.\n` +
        `   2. Botón "Compartir" → agregá: ${email}\n` +
        `   3. Rol: Editor → Listo.`,
      );
    }
    if (status === 404) {
      fail(
        `404 Not Found — GOOGLE_SHEETS_SPREADSHEET_ID incorrecto.\n` +
        `   Buscá el ID en la URL:\n` +
        `   https://docs.google.com/spreadsheets/d/<ESTE_ID>/edit`,
      );
    }
    fail(`Falló la conexión (status ${status ?? "?"}): ${e.message ?? err}`);
  }

  // Paso 3: ensureSheet + escritura de fila de prueba.
  try {
    await sheets.ensureSheet("Leads", LEADS_HEADERS);
    const now = new Date().toISOString();
    await sheets.appendValues("Leads!A2:N", [[
      TEST_ID, "doctor-test", "mock", "0000000000", "Doctor Test",
      "", "", "new", "greeting", now, now, now, "[]", "fila de prueba — borrable",
    ]]);
    console.log(`✅ Paso 3: Escritura OK — fila de prueba agregada a "Leads"\n`);
  } catch (err) {
    const e = err as { message?: string };
    fail(`Falló la escritura en "Leads": ${e.message ?? err}`);
  }

  // Paso 4: lectura de verificación + limpieza.
  try {
    const rows = await sheets.getValues("Leads!A2:N");
    const idx  = rows.findIndex((r) => r[0] === TEST_ID);
    if (idx < 0) {
      fail(`La fila fue escrita pero no se encontró al leer. Revisá los permisos de la hoja.`);
    }
    console.log(`✅ Paso 4: Lectura de verificación OK — fila encontrada en la fila ${idx + 2}\n`);

    // Limpieza: vaciar la fila de prueba para no dejar basura.
    const rowNum = idx + 2;
    await sheets.updateValues(`Leads!A${rowNum}:N${rowNum}`, [Array<string>(14).fill("")]);
    console.log(`🧹 Fila de prueba limpiada (fila ${rowNum} vaciada)\n`);
  } catch (err) {
    const e = err as { message?: string };
    fail(`Falló la lectura/limpieza: ${e.message ?? err}`);
  }

  // Paso 5: pestaña Sesiones.
  try {
    await sheets.ensureSheet("Sesiones", SESIONES_HEADERS);
    console.log(`✅ Paso 5: Pestaña "Sesiones" OK\n`);
  } catch (err) {
    const e = err as { message?: string };
    fail(`Falló la verificación de "Sesiones": ${e.message ?? err}`);
  }

  console.log(`🎉 Todo funciona. Google Sheets está correctamente configurado.\n`);
  console.log(`   Las pestañas "Leads" y "Sesiones" ya existen con sus encabezados.`);
  console.log(`   Podés verlas en:`);
  console.log(`   https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
