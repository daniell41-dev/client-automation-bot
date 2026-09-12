/**
 * Corre DESPUÉS de `pnpm ai:doctor` en el workflow "Alarma de deprecación de
 * modelos" (T-15, `.github/workflows/ai-doctor-alarm.yml`). Lee el reporte
 * estructurado que `ai-doctor.ts` escribe en `AI_DOCTOR_REPORT_PATH` cuando
 * esa variable está seteada, y abre (o comenta, si ya existe) un issue de
 * GitHub por cada proveedor CONFIGURADO (tiene su `*_API_KEY`) que falló.
 *
 * Un proveedor sin key configurada NUNCA genera issue — eso no es una alarma,
 * es que ese proveedor no está en uso todavía (por ejemplo, en un fork o un
 * entorno de CI sin todos los secrets cargados).
 *
 * Requiere `GITHUB_TOKEN` (con permiso `issues: write`) y `GITHUB_REPOSITORY`
 * — ambos los inyecta GitHub Actions solos. Fuera de un workflow no hace nada
 * (falla silenciosamente con un aviso, no rompe una corrida local).
 */

import { readFileSync } from "node:fs";

export interface ProviderReport {
  name: string;
  model: string;
  apiKeyPresent: boolean;
  ok: boolean;
  error?: string;
  modelosDisponibles?: string[];
}

export interface Report {
  providers: ProviderReport[];
}

/** Proveedores que tienen key configurada pero fallaron — los únicos que ameritan issue. */
export function pickFailingProviders(report: Report): ProviderReport[] {
  return report.providers.filter((p) => p.apiKeyPresent && !p.ok);
}

const REPORT_PATH = process.env.AI_DOCTOR_REPORT_PATH ?? "ai-doctor-report.json";
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY; // "owner/repo", lo pone Actions solo
const LABEL = "ai-doctor";

function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
}

export function issueTitle(p: ProviderReport): string {
  return `🔔 [ai-doctor] ${p.name} no responde (modelo ${p.model})`;
}

export function issueBody(p: ProviderReport): string {
  const modelos = p.modelosDisponibles?.length
    ? `\n\n**Modelos disponibles para esta key ahora mismo:**\n${p.modelosDisponibles
        .map((m) => `- \`${m}\``)
        .join("\n")}`
    : "";
  return (
    `\`pnpm ai:doctor\` detectó que **${p.name}** (modelo configurado: \`${p.model}\`) ` +
    `no respondió correctamente.\n\n**Error exacto:**\n\`\`\`\n${p.error ?? "(sin detalle)"}\n\`\`\`` +
    modelos +
    `\n\nRevisar \`${p.name.toUpperCase()}_MODEL\` en las variables de entorno del proyecto ` +
    `(ver \`docs/11-proveedor-ia.md\`). Si el modelo configurado ya no está en la lista de ` +
    `arriba, ese es el problema — ajustarlo a uno de los disponibles resuelve la alarma.\n\n` +
    `_Este issue lo abre/actualiza automáticamente el workflow "Alarma de deprecación de ` +
    `modelos" (T-15), corrido por \`pnpm ai:doctor\`._`
  );
}

async function findOpenIssue(title: string): Promise<number | null> {
  const res = await api(`/issues?state=open&labels=${LABEL}&per_page=100`);
  if (!res.ok) {
    throw new Error(`No se pudo listar issues abiertos: ${res.status} ${await res.text()}`);
  }
  const issues = (await res.json()) as { number: number; title: string }[];
  return issues.find((i) => i.title === title)?.number ?? null;
}

async function main(): Promise<void> {
  if (!TOKEN || !REPO) {
    console.log(
      "ℹ️  Sin GITHUB_TOKEN/GITHUB_REPOSITORY — este script solo corre dentro de un workflow de Actions.",
    );
    return;
  }

  let report: Report;
  try {
    report = JSON.parse(readFileSync(REPORT_PATH, "utf-8")) as Report;
  } catch {
    console.log(`ℹ️  No encontré ${REPORT_PATH} — nada que reportar.`);
    return;
  }

  const fallando = pickFailingProviders(report);
  if (fallando.length === 0) {
    console.log("✅ Todos los proveedores configurados respondieron bien — no se abre ningún issue.");
    return;
  }

  for (const p of fallando) {
    const title = issueTitle(p);
    const body = issueBody(p);
    const existing = await findOpenIssue(title);

    if (existing) {
      const res = await api(`/issues/${existing}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: `Volvió a fallar en la corrida de hoy:\n\n${body}` }),
      });
      if (!res.ok) {
        throw new Error(`No se pudo comentar el issue #${existing}: ${res.status} ${await res.text()}`);
      }
      console.log(`↻ Ya existía el issue #${existing} ("${title}") — agregué un comentario.`);
    } else {
      const res = await api(`/issues`, {
        method: "POST",
        body: JSON.stringify({ title, body, labels: [LABEL] }),
      });
      if (!res.ok) {
        throw new Error(`No se pudo crear el issue: ${res.status} ${await res.text()}`);
      }
      const created = (await res.json()) as { number: number; html_url: string };
      console.log(`🆕 Issue #${created.number} creado: ${created.html_url}`);
    }
  }

  // El job queda en rojo cuando de verdad hay algo que atender — la alarma
  // real es el issue, esto es solo para que la pestaña Actions no mienta.
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
