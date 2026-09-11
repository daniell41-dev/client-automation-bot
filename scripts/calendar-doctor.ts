/**
 * Diagnóstico de Google Calendar (`pnpm calendar:doctor`).
 *
 * Verifica de punta a punta que la integración con Calendar funciona para un
 * negocio específico:
 *   1. ¿Están las credenciales globales (service account)?
 *   2. ¿El negocio tiene calendarId configurado?
 *   3. ¿La auth conecta con scope de Calendar? (lee metadatos del calendario)
 *   4. ¿Puede crear un evento? (insert de un evento de prueba)
 *   5. ¿Puede leer y BORRAR lo que creó? (get + delete, sin ensuciar la agenda)
 *
 * Usa el cliente de googleapis directamente (no la interfaz angosta de la app)
 * porque necesita borrar el evento de prueba, operación que la app no expone.
 *
 * Uso:
 *   pnpm calendar:doctor
 *   pnpm calendar:doctor --business estetica-bella
 */

import { google } from "googleapis";
import { loadEnvLocal } from "./load-env";
import { serviceAccountFromEnv } from "@/core/storage/adapters/google/auth";
import { getBusinessBySlug } from "@/businesses/registry";

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

/** Razón estructurada que devuelve Google (p. ej. "accessNotConfigured", "forbidden"). */
function extractReason(err: unknown): string | undefined {
  const e = err as { errors?: Array<{ reason?: string }>; message?: string };
  return e.errors?.[0]?.reason;
}

async function main() {
  loadEnvLocal();

  const slug = parseArgs();
  console.log(`\n🩺 Diagnóstico de Google Calendar — negocio: ${slug}\n`);

  // Paso 1: credenciales globales de la service account.
  const creds = serviceAccountFromEnv();
  if (!creds) {
    const missing: string[] = [];
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    if (!process.env.GOOGLE_PRIVATE_KEY)           missing.push("GOOGLE_PRIVATE_KEY");
    fail(
      `Faltan credenciales globales en .env.local:\n` +
      missing.map((v) => `   • ${v}`).join("\n"),
    );
  }

  console.log(`✅ Paso 1: Credenciales de service account detectadas`);
  console.log(`   Service Account: ${creds.email.split("@")[0]}@...\n`);

  // Paso 2: calendarId del negocio.
  const business = getBusinessBySlug(slug);
  if (!business) {
    fail(`Negocio "${slug}" no encontrado. Registralo en src/businesses/registry.ts`);
  }

  const calendarId = business.storage?.calendarId;
  if (!calendarId) {
    fail(
      `El negocio "${slug}" no tiene calendarId configurado.\n` +
      `   Agregá storage: { calendarId: "<ID>" } en src/businesses/${slug}/config.ts\n` +
      `   El ID está en: Configuración del calendario → Integrar calendario → ID del calendario.`,
    );
  }

  console.log(`✅ Paso 2: Calendar ID detectado (config del negocio)`);
  console.log(`   ID: ${calendarId}\n`);

  // Cliente de Calendar con scope de escritura de eventos.
  const auth = new google.auth.JWT({
    email: creds.email,
    key: creds.privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  // Paso 4: crear un evento de prueba (1 hora desde ahora, 15 min).
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const timezone = business.timezone ?? "America/Bogota";

  let eventId: string;
  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: "🩺 PRUEBA calendar:doctor — borrable",
        description: "Evento de diagnóstico. Se borra automáticamente.",
        start: { dateTime: start.toISOString(), timeZone: timezone },
        end: { dateTime: end.toISOString(), timeZone: timezone },
      },
    });
    eventId = res.data.id ?? "";
    if (!eventId) fail(`El evento se creó pero la API no devolvió un id.`);
    console.log(`✅ Paso 3-4: Conexión OK y evento de prueba creado`);
    console.log(`   Event ID: ${eventId}\n`);
  } catch (err) {
    const status = extractStatus(err);
    const reason = extractReason(err);
    const e = err as { message?: string };
    // 403 por API deshabilitada en el proyecto GCP (NO es problema de compartir).
    if (
      reason === "accessNotConfigured" ||
      (e.message ?? "").includes("has not been used in project")
    ) {
      fail(
        `La Google Calendar API NO está habilitada en tu proyecto de GCP.\n` +
        `   (Sheets y Calendar son APIs separadas: tener Sheets no habilita Calendar.)\n` +
        `   Habilitala acá y esperá 1-2 minutos:\n` +
        `   ${e.message?.match(/https:\/\/\S+/)?.[0] ?? "https://console.developers.google.com/apis/api/calendar-json.googleapis.com"}`,
      );
    }
    if (status === 403) {
      fail(
        `403 Forbidden — el calendario NO está compartido con la cuenta de servicio.\n` +
        `   1. Abrí Google Calendar → Configuración del calendario.\n` +
        `   2. "Compartir con determinadas personas" → agregá: ${creds.email}\n` +
        `   3. Permiso: "Hacer cambios en los eventos" → Listo.`,
      );
    }
    if (status === 404) {
      fail(
        `404 Not Found — calendarId incorrecto para "${slug}": ${calendarId}\n` +
        `   Verificá el ID en Configuración del calendario → Integrar calendario.`,
      );
    }
    fail(`Falló la creación del evento (status ${status ?? "?"}): ${e.message ?? err}`);
  }

  // Paso 5: leer de vuelta y borrar el evento de prueba.
  try {
    await calendar.events.get({ calendarId, eventId });
    await calendar.events.delete({ calendarId, eventId });
    console.log(`✅ Paso 5: Lectura de verificación OK y evento de prueba borrado 🧹\n`);
  } catch (err) {
    const e = err as { message?: string };
    fail(
      `El evento se creó pero falló la lectura/borrado: ${e.message ?? err}\n` +
      `   ⚠️  Puede haber quedado un evento "🩺 PRUEBA" en la agenda — borralo a mano.`,
    );
  }

  console.log(`🎉 Todo funciona. El calendario de "${slug}" está listo para agendar citas.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
