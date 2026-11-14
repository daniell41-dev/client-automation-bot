/**
 * T-87: las conversaciones de "Para qué negocios" tienen que ser lo que el bot
 * responde de verdad. Este test pasa los mismos mensajes por el motor (modo
 * guiado, plantillas de rubro) y exige que cada respuesta que muestra la
 * landing esté en lo que el bot contestó. Si cambia un texto del bot, este
 * test avisa que hay que actualizar la landing.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { handleIncoming } from "@/core/handle";
import { RUBROS_BASE } from "@/businesses/rubros";
import type { BusinessConfig, Lead, OutgoingMessage } from "@/core/types";
import type { LeadRepository } from "@/core/storage/repository";
import { Negocios } from "@/components/landing/negocios";
import { pestanaSegunTecla } from "@/components/landing/negocios-pestanas";

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

/** El precio sale con espacio duro ($ 18.000); en la landing va con espacio normal. */
const normal = (t: string) => t.replace(/ /g, " ");

async function conversar(config: BusinessConfig, mensajes: string[]): Promise<{ textos: string[]; opciones: string[] }> {
  const repo = new Repo();
  const salidas: OutgoingMessage[] = [];
  const ahora = new Date("2026-11-17T15:00:00-05:00"); // martes, dentro del horario
  for (const text of mensajes) {
    const r = await handleIncoming({ channel: "mock", businessSlug: config.slug, from: "573000000000", text, timestamp: ahora.toISOString() }, config, repo, ahora);
    salidas.push(...r.messages);
  }
  return { textos: salidas.map((m) => normal(m.text)), opciones: salidas.flatMap((m) => m.options ?? []) };
}

const plantilla = (slug: string) => RUBROS_BASE.find((r) => r.slug === slug)!.template;
const html = normal(renderToStaticMarkup(createElement(Negocios)));
/** Texto de la landing tal como se ve, burbuja por burbuja (los saltos de línea se conservan en el HTML). */
const enLanding = (frase: string) => expect(html, frase).toContain(frase);

describe("T-87: las conversaciones de la landing son las del bot", () => {
  it("barbería y estética: bienvenida con servicios y cita agendada (modo guiado)", async () => {
    const config: BusinessConfig = { ...plantilla("peluqueria"), slug: "peluqueria", botActivo: true };
    // T-88: la hora del primer mensaje se recuerda: después del nombre pasa directo a confirmar.
    const { textos, opciones } = await conversar(config, ["¿Tiene turno hoy a las 5?", "Corte caballero", "Andrés", "Sí, confirmar"]);
    for (const respuesta of [
      "¡Hola! Gracias por escribirnos ✂️ ¿Qué servicio le interesa?",
      "¡Listo Andrés! ✨ Su cita de Corte caballero para hoy a las 5 quedó agendada. Lo esperamos.",
    ]) {
      expect(textos, respuesta).toContain(respuesta);
      enLanding(respuesta);
    }
    for (const o of ["Corte dama", "Corte caballero", "Tinte"]) expect(opciones).toContain(o);
  });

  it("restaurante: precio, nombre y resumen con domicilio y total", async () => {
    const config: BusinessConfig = {
      ...plantilla("restaurante"),
      slug: "restaurante",
      botActivo: true,
      services: [
        { id: "hamburguesa", name: "Hamburguesa sencilla", description: "Carne, queso y papas.", price: 18000, keywords: ["hamburguesa", "hamburguesas"], categoria: "Platos" },
      ],
      pedidos: { enabled: true, pregunta: "¿Se lo enviamos a domicilio o lo recoge en el local?", opciones: ["Domicilio", "Recoger en el local"], costoDomicilio: 5000 },
    };
    const { textos, opciones } = await conversar(config, ["Buenas, 2 hamburguesas", "Laura", "2", "No, eso es todo", "Domicilio", "Av. 4 #12-30, La Riviera"]);
    expect(textos).toContain("Hamburguesa sencilla: Carne, queso y papas. — $ 18.000.\n\n¡Con gusto! ¿A nombre de quién va el pedido?");
    expect(textos.at(-1)).toBe(
      "2x Hamburguesa sencilla — $ 36.000\nDomicilio — $ 5.000\nTotal: $ 41.000\n\nEntrega: Domicilio\nDirección: Av. 4 #12-30, La Riviera\n\n¿Confirma su pedido?",
    );
    enLanding("Hamburguesa sencilla: Carne, queso y papas. — $ 18.000.\n\n¡Con gusto! ¿A nombre de quién va el pedido?");
    enLanding("2x Hamburguesa sencilla — $ 36.000\nDomicilio — $ 5.000\nTotal: $ 41.000");
    expect(opciones).toEqual(expect.arrayContaining(["Sí, confirmar", "Agregar más"]));
  });

  it("tienda: precio y las preguntas que hace de verdad (no promete apartar ni dice cuántos quedan)", async () => {
    const config: BusinessConfig = {
      ...plantilla("restaurante"),
      slug: "tienda",
      botActivo: true,
      pedidos: undefined,
      services: [{ id: "cargador-c", name: "Cargador tipo C", description: "Cargador rápido USB tipo C.", price: 25000, keywords: ["cargador", "tipo c"], stock: 3 }],
    };
    const { textos } = await conversar(config, ["¿Tienen cargador tipo C?", "Laura"]);
    const respuestas = [
      "Cargador tipo C: Cargador rápido USB tipo C. — $ 25.000.\n\n¡Con gusto! ¿A nombre de quién va el pedido?",
      "¿Cuántas unidades de Cargador tipo C quiere, Laura?",
    ];
    for (const r of respuestas) {
      expect(textos, r).toContain(r);
      enLanding(r);
    }
    expect(html).not.toMatch(/quedan 3|se lo aparto/i);
  });
});

describe("T-87: pestañas accesibles", () => {
  it("tablist con tres pestañas; la primera seleccionada y los otros paneles ocultos, pero en el HTML", () => {
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(3);
    expect(html.match(/role="tabpanel"[^>]*hidden=""/g)).toHaveLength(2);
    for (const etiqueta of ["Restaurantes", "Barberías y estética", "Tiendas"]) enLanding(`>${etiqueta}</button>`);
  });

  it("teclado: flechas con vuelta, Inicio y Fin; otras teclas no hacen nada", () => {
    expect(pestanaSegunTecla("ArrowRight", 0, 3)).toBe(1);
    expect(pestanaSegunTecla("ArrowRight", 2, 3)).toBe(0);
    expect(pestanaSegunTecla("ArrowLeft", 0, 3)).toBe(2);
    expect(pestanaSegunTecla("Home", 2, 3)).toBe(0);
    expect(pestanaSegunTecla("End", 0, 3)).toBe(2);
    expect(pestanaSegunTecla("a", 1, 3)).toBeNull();
  });
});
