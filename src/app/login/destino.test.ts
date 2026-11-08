import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/app/login/destino";

describe("destinoSeguro", () => {
  it("acepta rutas internas", () => {
    expect(destinoSeguro("/portal/negocios/sabores")).toBe("/portal/negocios/sabores");
  });

  it("rechaza cualquier cosa que el navegador lea como otro sitio", () => {
    expect(destinoSeguro("//sitio-falso.com")).toBeNull();
    expect(destinoSeguro("/\\sitio-falso.com")).toBeNull();
    expect(destinoSeguro("https://sitio-falso.com")).toBeNull();
    expect(destinoSeguro("")).toBeNull();
  });
});
