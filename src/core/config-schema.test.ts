import { describe, expect, it } from "vitest";
import { parseBusinessConfig } from "@/core/config-schema";
import { esteticaBella } from "@/businesses/estetica-bella/config";

describe("parseBusinessConfig", () => {
  it("acepta la config real de estética bella (round-trip por JSON)", () => {
    const parsed = parseBusinessConfig(JSON.parse(JSON.stringify(esteticaBella)));
    expect(parsed).not.toBeNull();
    expect(parsed?.slug).toBe("estetica-bella");
    expect(parsed?.services.length).toBeGreaterThan(0);
    expect(parsed?.personas?.whatsapp?.name).toBe("Isabella");
  });

  it("rechaza una config sin servicios", () => {
    const invalida = { ...JSON.parse(JSON.stringify(esteticaBella)), services: [] };
    expect(parseBusinessConfig(invalida)).toBeNull();
  });

  it("rechaza un slug que no es kebab-case", () => {
    const invalida = { ...JSON.parse(JSON.stringify(esteticaBella)), slug: "Mi Negocio!" };
    expect(parseBusinessConfig(invalida)).toBeNull();
  });

  it("rechaza mensajes incompletos (falta askConfirm)", () => {
    const base = JSON.parse(JSON.stringify(esteticaBella));
    delete base.messages.askConfirm;
    expect(parseBusinessConfig(base)).toBeNull();
  });

  it("rechaza cosas que no son objetos", () => {
    expect(parseBusinessConfig(null)).toBeNull();
    expect(parseBusinessConfig("texto")).toBeNull();
    expect(parseBusinessConfig(42)).toBeNull();
  });
});

describe("parseBusinessConfig — pedidos y notifyPhoneNumber", () => {
  it("acepta pedidos válido (enabled + pregunta + 2-4 opciones)", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      pedidos: {
        enabled: true,
        pregunta: "¿Retirás o comés acá?",
        opciones: ["Retirar", "Comer aquí"],
      },
      notifyPhoneNumber: "573001234567",
    };
    const parsed = parseBusinessConfig(config);
    expect(parsed?.pedidos?.opciones).toEqual(["Retirar", "Comer aquí"]);
    expect(parsed?.notifyPhoneNumber).toBe("573001234567");
  });

  it("rechaza pedidos con menos de 2 opciones", () => {
    const config = {
      ...JSON.parse(JSON.stringify(esteticaBella)),
      pedidos: { enabled: true, pregunta: "¿Y?", opciones: ["Solo una"] },
    };
    expect(parseBusinessConfig(config)).toBeNull();
  });

  it("sin pedidos ni notifyPhoneNumber la config sigue siendo válida (opcionales)", () => {
    const parsed = parseBusinessConfig(JSON.parse(JSON.stringify(esteticaBella)));
    expect(parsed?.pedidos).toBeUndefined();
    expect(parsed?.notifyPhoneNumber).toBeUndefined();
  });
});
