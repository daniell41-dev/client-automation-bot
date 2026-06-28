import { afterEach, describe, expect, it } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvLocal } from "./load-env";

describe("loadEnvLocal", () => {
  const tmpFile = join(tmpdir(), `env-test-${Date.now()}-${Math.random().toString(36).slice(2)}.env`);
  const KEY = "TEST_LOADENV_VAR_XYZ";

  afterEach(() => {
    delete process.env[KEY];
    try {
      rmSync(tmpFile);
    } catch {
      /* el archivo puede no existir */
    }
  });

  it("carga variables de un archivo con line endings CRLF (Windows)", () => {
    delete process.env[KEY];
    writeFileSync(tmpFile, `${KEY}=valor123\r\n`, "utf-8");
    loadEnvLocal(tmpFile);
    expect(process.env[KEY]).toBe("valor123");
  });

  it("carga variables de un archivo con line endings LF (Unix)", () => {
    delete process.env[KEY];
    writeFileSync(tmpFile, `${KEY}=valor456\n`, "utf-8");
    loadEnvLocal(tmpFile);
    expect(process.env[KEY]).toBe("valor456");
  });

  it("no sobreescribe variables ya presentes en el entorno", () => {
    process.env[KEY] = "previo";
    writeFileSync(tmpFile, `${KEY}=nuevo\r\n`, "utf-8");
    loadEnvLocal(tmpFile);
    expect(process.env[KEY]).toBe("previo");
  });
});
