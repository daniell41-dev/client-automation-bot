/**
 * T-80: la landing dice lo que el dueño del producto escribió, y nada que no
 * podamos cumplir. Se renderiza a HTML (son componentes de servidor sin
 * datos) y se revisa el texto que ve la persona.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home, { metadata } from "@/app/page";

const html = renderToStaticMarkup(createElement(Home));
/** Texto visible en una línea: sin etiquetas, sin el JSON-LD y con los saltos de línea como espacios. */
const texto = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

describe("landing (T-80)", () => {
  it("usa los textos dados, tal cual", () => {
    for (const frase of [
      "Su WhatsApp toma pedidos aunque usted esté en la cocina.",
      "le deja a usted la última palabra. Se lo instalamos aquí en Cúcuta.",
      "Escríbanos por WhatsApp",
      "Pruebe la demo",
      "Conexión oficial para empresas",
      "Instalación en persona",
      "Hecho en Cúcuta",
      "El cliente que escribió a las 9 p. m. y le compró a otro.",
      "El comprobante que ya le habían mandado antes.",
      "Nexo revisa el comprobante: monto, cuenta, referencia y fecha. Si algo no cuadra, le avisa.",
      "Pedidos con inventario: no vende lo que ya no tiene.",
      "Ningún pedido se despacha sin su aprobación.",
      "No inventa precios ni cuentas de pago.",
      "Hacemos un pedido de prueba juntos y le enseñamos a aprobar.",
      "Instalamos pocos negocios al mes porque lo hacemos en persona. Pregúntenos por los cupos.",
      "Los tratamos según la Ley 1581 de 2012.",
      "¿Quiere verlo funcionando con su negocio?",
      "Nexo · Cúcuta, Colombia",
      "Total: $45.000 ¿Confirma su pedido?",
    ]) {
      expect(texto, frase).toContain(frase);
    }
  });

  it("no promete lo que no podemos respaldar", () => {
    expect(texto).not.toMatch(/\d\s?%/); // porcentajes de ventas
    expect(texto).not.toMatch(/elimina el fraude|nunca se equivoca|SaaS|IA generativa/i);
  });

  it("deja a la vista las respuestas que faltan confirmar, en vez de inventarlas", () => {
    expect(texto.match(/\[CONFIRMAR CON DANIEL\]/g)).toHaveLength(2);
  });

  it("sin testimonios cargados no hay sección de testimonios", () => {
    expect(html).not.toContain('id="testimonios"');
  });

  it("sin NEXT_PUBLIC_WHATSAPP_VENTAS, cada botón de WhatsApp lleva a la demo", () => {
    const botones = [...html.matchAll(/<a[^>]*data-origen="([^"]+)"[^>]*>/g)];
    expect(botones.map((b) => b[1]).sort()).toEqual(["barra-movil", "cierre", "hero", "precios"]);
    for (const [etiqueta] of botones) expect(etiqueta).toContain('href="/demo"');
  });

  it("no usa el logo de WhatsApp: la palabra va escrita", () => {
    expect(html).not.toMatch(/whatsapp\.(svg|png)|SiWhatsapp/i);
  });

  it("título, canónica y datos estructurados de la organización en Cúcuta", () => {
    expect(metadata.title).toEqual({ absolute: "Nexo · Pedidos, citas y pagos por WhatsApp en Cúcuta" });
    expect(metadata.alternates?.canonical).toBe("/");
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    expect(ld["@type"]).toBe("Organization");
    expect(ld.areaServed.name).toBe("Cúcuta");
  });
});
