/**
 * Diagnóstico de la IA (`pnpm ai:doctor`).
 *
 * Agnóstico de proveedor: revisa cada uno de los que estén configurados
 * (Gemini, Groq, Cerebras, custom) y muestra el resultado EXACTO, sin
 * tragarse errores. Por proveedor:
 *   1. ¿Está la *_API_KEY?
 *   2. ¿La key autentica? (lista los modelos disponibles, si el proveedor
 *      expone ese endpoint)
 *   3. ¿Una respuesta real de la IA (enhance)?
 *
 * Al final muestra la cadena de respaldo que arma `createLLMProvider()`.
 *
 * Uso:  pnpm ai:doctor
 */

import { OpenAICompatibleProvider } from "@/core/ai/openai-compatible";
import { AI_PRESETS, type PresetName } from "@/core/ai/presets";
import { createLLMProvider } from "@/core/ai/factory";
import { esteticaBella } from "@/businesses/estetica-bella/config";
import { loadEnvLocal } from "./load-env";

const PRESET_NAMES: PresetName[] = ["gemini", "groq", "cerebras"];

/** Prueba end-to-end de un proveedor concreto. Nunca lanza: devuelve ok/no. */
async function checkProvider(
  label: string,
  baseURL: string,
  apiKey: string,
  model: string,
): Promise<boolean> {
  const masked = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
  console.log(`\n🔎 ${label} (${masked}) — modelo configurado: ${model}`);

  // Paso 2 (informativo, no bloqueante): algunos proveedores no exponen /models.
  try {
    const res = await fetch(`${baseURL.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: { id: string }[] };
      const ids = data.data?.map((m) => m.id) ?? [];
      const hasModel = ids.length === 0 || ids.includes(model);
      console.log(
        `   ✅ Key válida. ${ids.length} modelos listados.${
          hasModel ? "" : ` ⚠️ "${model}" no está en la lista.`
        }`,
      );
    } else {
      console.log(`   ⚠️  No se pudo listar modelos (status ${res.status}); sigo con la prueba real.`);
    }
  } catch (err) {
    console.log(`   ⚠️  No se pudo listar modelos (${err}); sigo con la prueba real.`);
  }

  // Paso 3 (definitivo): una llamada real de enhance().
  try {
    const provider = new OpenAICompatibleProvider({ name: label, baseURL, apiKey, model });
    const persona =
      esteticaBella.personas?.whatsapp ?? {
        name: "Asistente",
        tone: "amable",
        language: "español",
      };
    const draft =
      "Nuestra Limpieza facial incluye: limpieza profunda. Duración: 60 minutos. Precio: $120.000.";
    const result = await provider.enhance({
      businessName: esteticaBella.name,
      persona,
      history: [{ role: "user", text: "Hola, info de limpieza facial", timestamp: "" }],
      draftResponse: draft,
      stage: "info_enviada",
    });

    if (result === draft) {
      console.log("   ❌ La IA devolvió el borrador SIN cambios → algo falló.");
      return false;
    }
    console.log(`   ✅ Respuesta real: ${result}`);
    return true;
  } catch (err) {
    console.log(`   ❌ Falló la llamada real: ${err}`);
    return false;
  }
}

async function main() {
  loadEnvLocal();
  console.log("\n🩺 Diagnóstico de IA (cadena de respaldo)\n");

  let anyOk = false;

  for (const name of PRESET_NAMES) {
    const envPrefix = name.toUpperCase();
    const apiKey = process.env[`${envPrefix}_API_KEY`];
    if (!apiKey) {
      console.log(`⏭  ${name}: sin ${envPrefix}_API_KEY, se omite.`);
      continue;
    }
    const preset = AI_PRESETS[name];
    const model = process.env[`${envPrefix}_MODEL`] || preset.defaultModel;
    const ok = await checkProvider(name, preset.baseURL, apiKey, model);
    anyOk = anyOk || ok;
  }

  const customApiKey = process.env.AI_CUSTOM_API_KEY;
  const customBaseURL = process.env.AI_CUSTOM_BASE_URL;
  const customModel = process.env.AI_CUSTOM_MODEL;
  if (customApiKey && customBaseURL && customModel) {
    const ok = await checkProvider("custom", customBaseURL, customApiKey, customModel);
    anyOk = anyOk || ok;
  } else if (customApiKey || customBaseURL || customModel) {
    console.log(
      "⏭  custom: hay que definir las 3 variables (AI_CUSTOM_API_KEY, " +
        "AI_CUSTOM_BASE_URL, AI_CUSTOM_MODEL) para activarlo, se omite.",
    );
  }

  if (!anyOk) {
    console.error(
      "\n❌ Ningún proveedor de IA está configurado o funcionando.\n" +
        "   Recomendado para negocios en Venezuela: Gemini (soporte oficial\n" +
        "   de Google, gratis, sin tarjeta):\n" +
        "     1. Crea una key en https://aistudio.google.com/apikey\n" +
        "     2. Agrégala a .env.local:  GEMINI_API_KEY=tu_key\n" +
        "   Ver docs/11-proveedor-ia.md para la comparativa completa.\n",
    );
    process.exit(1);
  }

  const chain = createLLMProvider();
  console.log(`\n🎉 Todo funciona. Cadena activa: ${chain?.model}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
