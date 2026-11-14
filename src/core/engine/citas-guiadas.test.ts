/**
 * T-88: el flujo guiado de citas con la plantilla real de peluquería, para
 * los tres bugs que encontró la T-87 al armar los ejemplos de la landing:
 * 1. "Corte caballero" (escrito o tocando el botón) agendaba "Corte dama";
 * 2. la hora que venía en el primer mensaje se descartaba y se volvía a pedir;
 * 3. "hoy a las 5 p. m." se guardaba como "hoy a las 5 p . me".
 */

import { describe, expect, it } from "vitest";
import { handleIncoming } from "@/core/handle";
import { RUBROS_BASE } from "@/businesses/rubros";
import type { BusinessConfig, Lead } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";

class Repo implements LeadRepository {
  leads: Lead[] = [];
  async findByContact(b: string, c: string) {
    return this.leads.find((l) => l.businessSlug === b && l.contact === c) ?? null;
  }
  async getById(id: string) {
    return this.leads.find((l) => l.id === id) ?? null;
  }
  async save(l: Lead) {
    const i = this.leads.findIndex((x) => x.id === l.id);
    if (i >= 0) this.leads[i] = l;
    else this.leads.push(l);
    return l;
  }
  async list() {
    return this.leads;
  }
}

const peluqueria: BusinessConfig = { ...RUBROS_BASE.find((r) => r.slug === "peluqueria")!.template, slug: "peluqueria", botActivo: true };
const ahora = new Date("2026-11-17T15:00:00-05:00"); // martes, dentro del horario

async function conversar(mensajes: string[]) {
  const repo = new Repo();
  const respuestas: string[] = [];
  for (const text of mensajes) {
    const r = await handleIncoming({ channel: "mock", businessSlug: "peluqueria", from: "573000000000", text, timestamp: ahora.toISOString() }, peluqueria, repo, ahora);
    respuestas.push(r.messages.map((m) => m.text).join("\n"));
  }
  return { lead: repo.leads[0], respuestas };
}

describe("citas guiadas (T-88)", () => {
  it("«Corte caballero» por el botón del menú agenda Corte caballero, no Corte dama", async () => {
    const { lead, respuestas } = await conversar(["Hola", "Corte caballero", "Andrés", "hoy a las 5 de la tarde", "Sí, confirmar"]);
    expect(lead.serviceId).toBe("corte-caballero");
    expect(respuestas.at(-1)).toContain("Su cita de Corte caballero para hoy a las 5 de la tarde quedó agendada");
  });

  it("servicio y hora en el mismo mensaje: no vuelve a pedir la hora, pasa del nombre a confirmar", async () => {
    const { lead, respuestas } = await conversar(["Quiero un corte caballero hoy a las 5", "Andrés"]);
    expect(lead.serviceId).toBe("corte-caballero");
    expect(lead.tentativeDate).toBe("hoy a las 5");
    expect(respuestas[1]).toBe("¿Le confirmo su cita de Corte caballero para hoy a las 5, Andrés?");
  });

  it("la hora en el primer mensaje, antes del menú, se recuerda después de elegir el servicio", async () => {
    const { lead, respuestas } = await conversar(["¿Tiene turno hoy a las 5?", "Corte caballero", "Andrés", "Sí, confirmar"]);
    expect(respuestas[0]).toContain("¿Qué servicio le interesa?");
    expect(respuestas[2]).toBe("¿Le confirmo su cita de Corte caballero para hoy a las 5, Andrés?");
    expect(lead.stage).toBe("datos_completos");
    expect(respuestas.at(-1)).toContain("Su cita de Corte caballero para hoy a las 5 quedó agendada");
  });

  it("«p. m.» llega bien a la confirmación", async () => {
    const { lead, respuestas } = await conversar(["Hola", "Tinte", "Andrés", "hoy a las 5 p. m."]);
    expect(lead.tentativeDate).toBe("hoy a las 5 pm");
    expect(respuestas.at(-1)).toBe("¿Le confirmo su cita de Tinte para hoy a las 5 pm, Andrés?");
    expect(respuestas.join(" ")).not.toContain("p . me");
  });

  it("sin hora en el primer mensaje, el flujo de siempre: pide la fecha después del nombre", async () => {
    const { respuestas } = await conversar(["Hola, buenas tardes", "Tinte", "Andrés"]);
    expect(respuestas[2]).toBe("Genial Andrés ¿Qué día y hora le queda bien?");
  });
});
