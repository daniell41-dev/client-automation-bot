import { describe, expect, it } from "vitest";
import {
  issueBody,
  issueTitle,
  pickFailingProviders,
  type ProviderReport,
  type Report,
} from "./ai-doctor-report-issue";

function provider(overrides: Partial<ProviderReport>): ProviderReport {
  return { name: "groq", model: "openai/gpt-oss-20b", apiKeyPresent: true, ok: true, ...overrides };
}

describe("pickFailingProviders", () => {
  it("descarta los proveedores sin key configurada, aunque no estén ok", () => {
    const report: Report = {
      providers: [provider({ apiKeyPresent: false, ok: false })],
    };
    expect(pickFailingProviders(report)).toEqual([]);
  });

  it("descarta los proveedores configurados que sí respondieron bien", () => {
    const report: Report = { providers: [provider({ ok: true })] };
    expect(pickFailingProviders(report)).toEqual([]);
  });

  it("incluye solo los proveedores CON key configurada que fallaron", () => {
    const ok = provider({ name: "gemini", ok: true });
    const sinKey = provider({ name: "cerebras", apiKeyPresent: false, ok: false });
    const falla = provider({ name: "groq", ok: false, error: "404 model not found" });
    const report: Report = { providers: [ok, sinKey, falla] };
    expect(pickFailingProviders(report)).toEqual([falla]);
  });
});

describe("issueTitle", () => {
  it("identifica al proveedor y al modelo configurado", () => {
    const title = issueTitle(provider({ name: "groq", model: "modelo-que-no-existe" }));
    expect(title).toBe("🔔 [ai-doctor] groq no responde (modelo modelo-que-no-existe)");
  });
});

describe("issueBody", () => {
  it("incluye el error exacto", () => {
    const body = issueBody(provider({ error: "404 model_not_found: modelo-que-no-existe" }));
    expect(body).toContain("404 model_not_found: modelo-que-no-existe");
  });

  it("incluye el catálogo de modelos disponibles cuando lo hay", () => {
    const body = issueBody(
      provider({ modelosDisponibles: ["openai/gpt-oss-20b", "llama-3.3-70b-versatile"] }),
    );
    expect(body).toContain("openai/gpt-oss-20b");
    expect(body).toContain("llama-3.3-70b-versatile");
  });

  it("no menciona un catálogo si no hay modelos listados", () => {
    const body = issueBody(provider({ modelosDisponibles: undefined }));
    expect(body).not.toContain("Modelos disponibles");
  });
});
