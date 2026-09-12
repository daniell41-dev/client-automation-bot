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
 *   4. ¿Una respuesta real en MODO AGENTE (runAgent)? — prueba aparte porque
 *      un prompt más largo + JSON estricto puede fallar aunque enhance()
 *      funcione (ver docs/13-modo-agente.md).
 *
 * Al final muestra la cadena de respaldo que arma `createLLMProvider()`.
 *
 * Uso:  pnpm ai:doctor
 *
 * Si `AI_DOCTOR_REPORT_PATH` está seteada, además escribe un reporte JSON
 * estructurado ahí (ver `ProviderReport`) — lo usa el workflow "Alarma de
 * deprecación de modelos" (T-15, `.github/workflows/ai-doctor-alarm.yml`)
 * para decidir a qué proveedores configurados abrirles un issue. En uso
 * normal desde la terminal esta variable no está seteada y no cambia nada.
 */

import { writeFileSync } from "node:fs";
import { OpenAICompatibleProvider } from "@/core/ai/openai-compatible";
import { AI_PRESETS, type AIPreset, type PresetName } from "@/core/ai/presets";
import { createLLMProvider, resolveAgentTimeoutMs, resolveReasoningEffort } from "@/core/ai/factory";
import { availableServices } from "@/core/engine/intake";
import { esteticaBella } from "@/businesses/estetica-bella/config";
import { DEFAULT_TIMEZONE } from "@/core/timezone";
import { loadEnvLocal } from "./load-env";

const PRESET_NAMES: PresetName[] = ["gemini", "groq", "cerebras"];

interface ProviderCheckResult {
  ok: boolean;
  /** Listado real de modelos que devuelve la key (paso 2), si el endpoint existe. */
  modelosDisponibles?: string[];
  /** Error concreto de la primera llamada real que falló (enhance o runAgent). */
  error?: string;
}

interface ProviderReport extends ProviderCheckResult {
  name: string;
  model: string;
  apiKeyPresent: boolean;
}

/**
 * Paso 4: una llamada real de `runAgent` con el catálogo de estética-bella.
 * Mide el tiempo (para calibrar `AI_AGENT_TIMEOUT_MS`) e imprime el JSON
 * crudo — si falla, el motivo ya queda logueado por `runAgent` mismo.
 */
async function checkAgentMode(provider: OpenAICompatibleProvider): Promise<boolean> {
  const persona =
    esteticaBella.personas?.whatsapp ?? { name: "Asistente", tone: "amable", language: "español" };

  const start = Date.now();
  const result = await provider.runAgent({
    businessName: esteticaBella.name,
    rubro: esteticaBella.rubro,
    currency: esteticaBella.currency,
    locale: esteticaBella.locale,
    persona,
    services: availableServices(esteticaBella.services).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      durationMinutes: s.durationMinutes,
      categoria: s.categoria,
    })),
    lead: { yaConfirmado: false, offTopicCount: 0 },
    history: [],
    message: "Hola, quiero información de limpieza facial",
    nowISO: new Date().toISOString(),
    timezone: esteticaBella.timezone ?? DEFAULT_TIMEZONE,
  });
  const ms = Date.now() - start;

  if (!result) {
    console.log(`   ❌ runAgent no devolvió un turno válido (${ms}ms) — ver el motivo arriba.`);
    return false;
  }
  console.log(`   ✅ runAgent respondió en ${ms}ms: ${JSON.stringify(result)}`);
  return true;
}

/** Prueba end-to-end de un proveedor concreto. Nunca lanza: devuelve el resultado. */
async function checkProvider(
  label: string,
  baseURL: string,
  apiKey: string,
  model: string,
  modelEnvVar: string,
  reasoningEffort: string | undefined,
): Promise<ProviderCheckResult> {
  const masked = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
  console.log(`\n🔎 ${label} (${masked}) — modelo configurado: ${model}`);

  // Paso 2 (informativo, no bloqueante): algunos proveedores no exponen /models.
  // Los modelos de estos proveedores rotan seguido (Groq los da de baja con
  // frecuencia, Google también) — si el configurado no está en la lista, se
  // imprimen los reales para no tener que adivinar cuál usar.
  let modelosDisponibles: string[] | undefined;
  try {
    const res = await fetch(`${baseURL.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: { id: string }[] };
      // Gemini devuelve los IDs con el prefijo "models/" (p. ej.
      // "models/gemini-3.5-flash-lite"); Groq/Cerebras no lo usan. Se
      // compara sin ese prefijo para no marcar un falso positivo.
      const stripPrefix = (id: string) => id.replace(/^models\//, "");
      const ids = data.data?.map((m) => stripPrefix(m.id)) ?? [];
      modelosDisponibles = ids;
      const hasModel = ids.length === 0 || ids.includes(model);
      console.log(`   ✅ Key válida. ${ids.length} modelos listados.`);
      if (!hasModel) {
        console.log(`   ⚠️  "${model}" no está en la lista. Modelos disponibles para tu key:`);
        console.log(`      ${ids.slice(0, 20).join(", ")}${ids.length > 20 ? ", …" : ""}`);
        console.log(`      Ajustá ${modelEnvVar} en .env.local a uno de estos.`);
      }
    } else {
      console.log(`   ⚠️  No se pudo listar modelos (status ${res.status}); sigo con la prueba real.`);
    }
  } catch (err) {
    console.log(`   ⚠️  No se pudo listar modelos (${err}); sigo con la prueba real.`);
  }

  // Mismo provider (con la misma config de reasoning_effort/timeout) que
  // usaría createLLMProvider() en producción — sin esto, el diagnóstico
  // podría pasar con una config que el bot real no usa.
  const provider = new OpenAICompatibleProvider({
    name: label,
    baseURL,
    apiKey,
    model,
    reasoningEffort,
    agentTimeoutMs: resolveAgentTimeoutMs(),
  });

  // Paso 3: una llamada real de enhance().
  let enhanceOk: boolean;
  let enhanceError: string | undefined;
  try {
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
      enhanceOk = false;
      enhanceError = "La IA devolvió el borrador sin cambios (respuesta vacía o descartada).";
    } else {
      console.log(`   ✅ Respuesta real (enhance): ${result}`);
      enhanceOk = true;
    }
  } catch (err) {
    console.log(`   ❌ Falló la llamada real (enhance): ${err}`);
    enhanceError = String(err);
    if (enhanceError.includes("404")) {
      console.log(
        `      Pinta a modelo dado de baja/renombrado — revisá la lista de modelos disponibles arriba.`,
      );
      enhanceError += " (pinta a modelo dado de baja/renombrado)";
    }
    enhanceOk = false;
  }

  // Paso 4: una llamada real de runAgent (modo agente) — ver `checkAgentMode`.
  let agentOk: boolean;
  let agentError: string | undefined;
  try {
    agentOk = await checkAgentMode(provider);
    if (!agentOk) agentError = "runAgent no devolvió un turno válido (ver log de arriba).";
  } catch (err) {
    console.log(`   ❌ Falló la llamada real (runAgent): ${err}`);
    agentError = String(err);
    agentOk = false;
  }

  const ok = enhanceOk && agentOk;
  const error = ok
    ? undefined
    : [enhanceError && `enhance: ${enhanceError}`, agentError && `runAgent: ${agentError}`]
        .filter((v): v is string => Boolean(v))
        .join(" | ");

  return { ok, modelosDisponibles, error };
}

async function main() {
  loadEnvLocal();
  console.log("\n🩺 Diagnóstico de IA (cadena de respaldo)\n");

  let anyOk = false;
  const reports: ProviderReport[] = [];

  for (const name of PRESET_NAMES) {
    const envPrefix = name.toUpperCase();
    const apiKey = process.env[`${envPrefix}_API_KEY`];
    if (!apiKey) {
      console.log(`⏭  ${name}: sin ${envPrefix}_API_KEY, se omite.`);
      reports.push({ name, model: AI_PRESETS[name].defaultModel, apiKeyPresent: false, ok: false });
      continue;
    }
    const preset: AIPreset = AI_PRESETS[name];
    const model = process.env[`${envPrefix}_MODEL`] || preset.defaultModel;
    const result = await checkProvider(
      name,
      preset.baseURL,
      apiKey,
      model,
      `${envPrefix}_MODEL`,
      resolveReasoningEffort(preset.reasoningEffort),
    );
    anyOk = anyOk || result.ok;
    reports.push({ name, model, apiKeyPresent: true, ...result });
  }

  const customApiKey = process.env.AI_CUSTOM_API_KEY;
  const customBaseURL = process.env.AI_CUSTOM_BASE_URL;
  const customModel = process.env.AI_CUSTOM_MODEL;
  if (customApiKey && customBaseURL && customModel) {
    const result = await checkProvider(
      "custom",
      customBaseURL,
      customApiKey,
      customModel,
      "AI_CUSTOM_MODEL",
      resolveReasoningEffort(undefined),
    );
    anyOk = anyOk || result.ok;
    reports.push({ name: "custom", model: customModel, apiKeyPresent: true, ...result });
  } else if (customApiKey || customBaseURL || customModel) {
    console.log(
      "⏭  custom: hay que definir las 3 variables (AI_CUSTOM_API_KEY, " +
        "AI_CUSTOM_BASE_URL, AI_CUSTOM_MODEL) para activarlo, se omite.",
    );
  }

  const reportPath = process.env.AI_DOCTOR_REPORT_PATH;
  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ providers: reports }, null, 2));
    console.log(`\n📄 Reporte estructurado escrito en ${reportPath}`);
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
