import { describe, expect, it } from "vitest";
import { existeEnPublic } from "@/lib/archivo-publico";

describe("existeEnPublic (T-86)", () => {
  it("encuentra un archivo que sí está en public/", () => {
    expect(existeEnPublic("/.gitkeep")).toBe(true);
  });

  it("no encuentra lo que todavía no se subió (la sección o el video no se muestran)", () => {
    expect(existeEnPublic("/landing/responsable.jpg")).toBe(false);
    expect(existeEnPublic("/landing/demo.mp4")).toBe(false);
  });

  it("no sale de public/ con rutas que suben de carpeta", () => {
    expect(existeEnPublic("/../package.json")).toBe(false);
  });
});
