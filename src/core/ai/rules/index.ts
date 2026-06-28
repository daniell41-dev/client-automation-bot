/**
 * Reglas globales que la IA debe tener en cuenta SIEMPRE.
 *
 * Formato híbrido:
 *  - El texto de cada regla vive en un `.md` editable dentro de `global/`
 *    (cualquiera puede ajustarlo sin tocar código).
 *  - Este índice define el ORDEN y la LÓGICA condicional: algunas reglas solo
 *    aplican en ciertos momentos de la conversación (p. ej. "no vuelvas a
 *    saludar" solo si la charla ya empezó).
 *
 * `buildRulesBlock(ctx)` arma el bloque numerado que se inyecta en el system
 * prompt (ver `buildSystemPrompt` en `prompt.ts`). La numeración es dinámica:
 * al filtrar las reglas condicionales, se re-numera 1..N sin huecos.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { LLMContext } from "@/core/ai/provider";

/** Una regla del prompt: su texto (archivo .md) y cuándo aplica. */
interface Rule {
  /** Identificador estable (para tests y debugging). */
  id: string;
  /** Nombre del archivo dentro de `global/`. */
  file: string;
  /** Si falta, la regla aplica siempre. Si está, solo aplica cuando devuelve `true`. */
  applies?: (ctx: LLMContext) => boolean;
}

/** ¿La conversación ya empezó? (hay al menos un turno del asistente). */
const enCurso = (ctx: LLMContext): boolean =>
  ctx.history.some((t) => t.role === "assistant");

/**
 * Registro de reglas, en orden. Para agregar una regla nueva: crea su `.md` en
 * `global/` y añádela aquí (con `applies` si es condicional).
 */
const RULES: Rule[] = [
  { id: "respuesta-unica", file: "01-respuesta-unica.md" },
  { id: "conservar-datos", file: "02-conservar-datos.md" },
  { id: "no-inventar", file: "03-no-inventar.md" },
  { id: "brevedad", file: "04-brevedad.md" },
  { id: "idioma", file: "05-idioma.md" },
  { id: "no-resaludar", file: "06-no-resaludar.md", applies: enCurso },
  { id: "conservar-menus", file: "07-conservar-menus.md" },
  { id: "no-agregar", file: "08-no-agregar-preguntas.md" },
  {
    id: "pedir-nombre",
    file: "09-pedir-nombre-carismatico.md",
    applies: (c) => !enCurso(c),
  },
  { id: "contexto-gracias", file: "10-contexto-gracias.md" },
];

/** Directorio `global/` resuelto relativo a este módulo. */
const GLOBAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "global");

/** Cache del contenido leído (las reglas no cambian en runtime). */
const cache = new Map<string, string>();

/** Lee y cachea el texto de una regla; tolera lectura fallida para no romper el flujo. */
function loadRule(file: string): string {
  const cached = cache.get(file);
  if (cached !== undefined) return cached;
  let text = "";
  try {
    text = readFileSync(join(GLOBAL_DIR, file), "utf8").trim();
  } catch (err) {
    console.warn(`[rules] no se pudo leer la regla "${file}":`, err);
  }
  cache.set(file, text);
  return text;
}

/**
 * Construye el bloque de reglas numerado para el system prompt, aplicando las
 * condiciones de cada regla según el contexto de la conversación.
 */
export function buildRulesBlock(ctx: LLMContext): string {
  return RULES.filter((r) => !r.applies || r.applies(ctx))
    .map((r) => loadRule(r.file))
    .filter((text) => text.length > 0)
    .map((text, i) => `${i + 1}. ${text}`)
    .join("\n");
}
