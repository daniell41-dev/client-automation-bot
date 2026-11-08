import { describe, expect, it } from "vitest";
import { validarNuevaContrasena } from "@/app/cuenta/contrasena/validar";

describe("validarNuevaContrasena", () => {
  it("acepta una contraseña de 8 o más que coincide", () => {
    expect(validarNuevaContrasena("cucuta2026", "cucuta2026")).toBeNull();
  });

  it("rechaza una corta o que no coincide", () => {
    expect(validarNuevaContrasena("corta", "corta")).toContain("8 caracteres");
    expect(validarNuevaContrasena("cucuta2026", "cucuta2025")).toContain("no coinciden");
  });
});
