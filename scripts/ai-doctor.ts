/**
 * Diagnóstico de la IA (`pnpm ai:doctor`).
 *
 * Verifica de punta a punta que la integración con Groq funciona, mostrando
 * el resultado o el ERROR EXACTO (sin tragárselo). Tres pasos:
 *   1. ¿Está la GROQ_API_KEY?
 *   2. ¿La key autentica? (lista los modelos disponibles)
 *   3. ¿Una respuesta real de la IA?
 *
 * Uso:  pnpm ai:doctor
 */

import Groq from "groq-sdk";
import { GroqProvider } from "@/core/ai/groq";
import { esteticaBella } from "@/businesses/estetica-bella/config";
import { loadEnvLocal } from "./load-env";

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function main() {
  loadEnvLocal();
  console.log("\n🩺 Diagnóstico de IA (Groq)\n");

  // Paso 1: ¿hay key?
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    fail(
      "No encontré GROQ_API_KEY.\n" +
        "   1. Crea una key GRATIS en https://console.groq.com/keys\n" +
        "   2. Agrégala a .env.local:  GROQ_API_KEY=tu_key",
    );
  }
  const masked = `${key.slice(0, 6)}...${key.slice(-4)}`;
  console.log(`✅ Paso 1: GROQ_API_KEY detectada (${masked})`);

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const client = new Groq({ apiKey: key });

  // Paso 2: autenticación real → listar modelos.
  try {
    const models = await client.models.list();
    const ids = models.data.map((m) => m.id);
    const hasModel = ids.includes(model);
    console.log(`✅ Paso 2: Key válida. ${ids.length} modelos disponibles.`);
    console.log(
      `   Modelo configurado: ${model} ${hasModel ? "✓ disponible" : "✗ NO está en la lista"}`,
    );
    if (!hasModel) {
      console.log(`   Modelos de chat sugeridos: ${ids.slice(0, 8).join(", ")}`);
      fail(
        `El modelo "${model}" no está disponible para tu key.\n` +
          "   Ajusta GROQ_MODEL en .env.local a uno de los listados arriba.",
      );
    }
  } catch (err) {
    const e = err as { status?: number; message?: string };
    fail(
      `Falló la autenticación con Groq (status ${e.status ?? "?"}): ${e.message ?? err}\n` +
        "   Si es 401, la key es inválida o fue revocada. Crea otra en https://console.groq.com/keys",
    );
  }

  // Paso 3: una llamada real de mejora de respuesta.
  try {
    const provider = new GroqProvider(key, model);
    const persona =
      esteticaBella.personas?.whatsapp ?? {
        name: "Asistente",
        tone: "amable",
        language: "español",
      };
    const draft =
      "Nuestra Limpieza facial incluye: limpieza profunda. Duración: 60 minutos. Precio: $120.000.";
    console.log("\n⏳ Paso 3: enviando un mensaje de prueba a la IA...\n");
    const result = await provider.enhance({
      businessName: esteticaBella.name,
      persona,
      history: [{ role: "user", text: "Hola, info de limpieza facial", timestamp: "" }],
      draftResponse: draft,
      stage: "info_enviada",
    });

    if (result === draft) {
      fail(
        "La IA devolvió el borrador SIN cambios → algo falló en la llamada.\n" +
          "   Revisa el log de error [Groq] que debe haber aparecido arriba.",
      );
    }

    console.log("✅ Paso 3: La IA respondió correctamente.\n");
    console.log("   📝 Borrador original:");
    console.log(`      ${draft}\n`);
    console.log(`   ✨ Mejorado por ${persona.name} (Groq · ${model}):`);
    console.log(`      ${result}\n`);
    console.log("🎉 Todo funciona. La IA está activa y respondiendo.\n");
  } catch (err) {
    const e = err as { status?: number; message?: string };
    fail(
      `Falló la llamada de generación (status ${e.status ?? "?"}): ${e.message ?? err}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
