import { describe, expect, it } from "vitest";
import { configDesdePlantilla, slugDesdeNombre } from "@/app/portal/primer-negocio/armar";
import { RUBROS_BASE } from "@/businesses/rubros";
import { parseBusinessConfig } from "@/core/config-schema";

describe("slugDesdeNombre", () => {
  it("convierte el nombre en un slug sin tildes ni símbolos", () => {
    expect(slugDesdeNombre("Sabores del Sur")).toBe("sabores-del-sur");
    expect(slugDesdeNombre("  Peluquería Ñandú & Co. ")).toBe("peluqueria-nandu-co");
  });
});

describe("configDesdePlantilla", () => {
  it("copia la plantilla con el nombre y el slug del negocio, y el bot apagado", () => {
    const restaurante = RUBROS_BASE.find((r) => r.slug === "restaurante")!.template;
    const config = configDesdePlantilla({ ...restaurante, botActivo: true }, "Sabores del Sur", "sabores-del-sur");

    expect(config).toMatchObject({ name: "Sabores del Sur", slug: "sabores-del-sur", botActivo: false });
    expect(config.services).toEqual(restaurante.services);
    expect(parseBusinessConfig(JSON.parse(JSON.stringify(config)))).not.toBeNull();
  });
});
