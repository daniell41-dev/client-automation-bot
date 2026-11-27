import { describe, expect, it } from "vitest";
import {
  enAtencionHumana,
  HORAS_ATENCION_HUMANA,
  mensajeAlCliente,
  pideHablarConPersona,
  textoAvisoDuena,
} from "@/core/engine/atencion-humana";
import type { BusinessConfig, Lead } from "@/core/types";

describe("pideHablarConPersona", () => {
  it.each([
    "quiero hablar con una persona",
    "Puedo hablar con alguien real?",
    "me comunica con un asesor por favor",
    "necesito hablar con la dueña",
    "pásame con el dueño",
    "no quiero hablar con un bot",
    "eres un robot? quiero un humano",
    "hablar con un agente",
    "¿puedo hablar con el encargado?",
  ])("«%s» sí", (texto) => {
    expect(pideHablarConPersona(texto)).toBe(true);
  });

  it.each([
    "hola, quiero 2 netflix",
    "la persona que va a recoger es mi hermana",
    "¿el dueño del perfil puede cambiar la clave?",
    "gracias, muy amable",
    "para 4 personas",
  ])("«%s» no", (texto) => {
    expect(pideHablarConPersona(texto)).toBe(false);
  });
});

describe("enAtencionHumana", () => {
  const ahora = new Date("2026-11-27T20:00:00.000Z");
  const lead = (desde?: string) => ({ atencionHumanaDesde: desde }) as Lead;

  it("mientras no pasen las horas de pausa, el asistente no responde", () => {
    expect(enAtencionHumana(lead("2026-11-27T19:00:00.000Z"), ahora)).toBe(true);
  });

  it(`después de ${HORAS_ATENCION_HUMANA} horas vuelve solo (por si la dueña se olvida de reactivarlo)`, () => {
    expect(enAtencionHumana(lead("2026-11-27T07:00:00.000Z"), ahora)).toBe(false);
  });

  it("sin pausa, responde", () => {
    expect(enAtencionHumana(lead(undefined), ahora)).toBe(false);
    expect(enAtencionHumana(null, ahora)).toBe(false);
  });
});

describe("textos", () => {
  const config = { name: "Streaming VE" } as BusinessConfig;

  it("al cliente: le avisa que le escribe una persona, sin prometer una hora", () => {
    expect(mensajeAlCliente(config)).toContain("Streaming VE");
    expect(mensajeAlCliente(config).toLowerCase()).toContain("persona");
  });

  it("a la dueña: quién, el link para escribirle y que el asistente se calla en esa conversación", () => {
    const texto = textoAvisoDuena(config, { contact: "584125550101", name: "Carla" } as Lead, "quiero hablar con alguien");
    expect(texto).toContain("Carla");
    expect(texto).toContain("wa.me/584125550101");
    expect(texto).toContain("«quiero hablar con alguien»");
    expect(texto).toContain(`${HORAS_ATENCION_HUMANA} horas`);
  });

  it("en Instagram no hay link de WhatsApp", () => {
    const texto = textoAvisoDuena(config, { contact: "17841400000000", channel: "instagram" } as Lead, "un humano");
    expect(texto).not.toContain("wa.me");
    expect(texto).toContain("Instagram");
  });
});

describe("inicioPausasVigentes", () => {
  it("es 12 horas antes de ahora", async () => {
    const { inicioPausasVigentes } = await import("@/core/engine/atencion-humana");
    expect(inicioPausasVigentes(new Date("2026-11-27T20:00:00.000Z"))).toBe("2026-11-27T08:00:00.000Z");
  });
});
