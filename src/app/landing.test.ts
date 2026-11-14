/**
 * T-80: la landing dice lo que el dueño del producto escribió, y nada que no
 * podamos cumplir. Se renderiza a HTML (son componentes de servidor sin
 * datos) y se revisa el texto que ve la persona.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Home, { metadata } from "@/app/page";
import { GARANTIA, Precio } from "@/components/landing/precio";

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
      "revisa el comprobante de pago y usted aprueba con un botón. Se lo instalamos aquí en Cúcuta.",
      "Escríbanos por WhatsApp",
      "Pruebe la demo",
      "Instalación gratis",
      "14 días de prueba",
      "Sin permanencia",
      "El cliente que escribió de noche y le compró a otro.",
      "El comprobante que ya le habían mandado antes.",
      "Nexo revisa el comprobante: monto, cuenta, referencia y fecha. Si algo no cuadra, le avisa.",
      "Pedidos con inventario: no vende lo que ya no tiene.",
      "Ningún pedido se despacha sin su aprobación.",
      "No inventa precios ni cuentas de pago.",
      "Hacemos un pedido de prueba juntos y le enseñamos a aprobar.",
      "Desde $79.900 al mes",
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

  it("T-81: no queda ninguna respuesta sin confirmar", () => {
    expect(texto).not.toContain("[CONFIRMAR CON DANIEL]");
  });

  it("T-81: las preguntas frecuentes hablan como una persona, sin la palabra \"bot\"", () => {
    const faq = html.match(/<section id="preguntas"[\s\S]*?<\/section>/)![0].replace(/<[^>]+>/g, " ");
    expect(faq).not.toMatch(/\bbots?\b/i);
    expect(faq).toContain("en unos 30 minutos lo dejamos funcionando");
  });

  it("sin testimonios cargados no hay sección de testimonios", () => {
    expect(html).not.toContain('id="testimonios"');
  });

  it("sin NEXT_PUBLIC_WHATSAPP_VENTAS, cada botón de WhatsApp lleva a la demo", () => {
    const botones = [...html.matchAll(/<a[^>]*data-origen="([^"]+)"[^>]*>/g)];
    expect(botones.map((b) => b[1]).sort()).toEqual(["barra-movil", "cierre", "comprobante", "hero", "precios"]);
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

  describe("T-82: hero animado", () => {
    it("el teléfono cuenta la historia completa: nota de voz, resumen, comprobante que no cuadra y aviso", () => {
      for (const frase of [
        "10:47 p. m.",
        "0:08",
        "Confirmo",
        "$40.000",
        "El comprobante dice $40.000, el pedido es $45.000.",
        "Para usted",
        "Revise el comprobante",
        "Aprobar",
        "Rechazar",
        "Pedir resto",
      ]) {
        expect(texto, frase).toContain(frase);
      }
    });

    it("la animación es decorativa: el lector de pantalla recibe la historia en una frase", () => {
      expect(html).toMatch(/role="img" aria-label="Ejemplo de un pedido por WhatsApp[^"]+"/);
    });

    it("sin JavaScript de cliente, y quieto con «reducir movimiento»", () => {
      const raiz = join(__dirname, "..", "..");
      expect(readFileSync(join(raiz, "src/components/landing/telefono-animado.tsx"), "utf8")).not.toMatch(/["']use client["']/);
      const css = readFileSync(join(raiz, "src/app/globals.css"), "utf8");
      // Cada paso tiene su animación, y con movimiento reducido todas se apagan mostrando el estado final.
      for (let n = 1; n <= 6; n++) expect(css).toContain(`.tel-paso-${n} { animation-name: telPaso${n}; }`);
      expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.tel-paso,[\s\S]*?animation: none;\s*opacity: 1;\s*transform: none;/);
    });

    it("las condiciones del hero coinciden con la sección de precio (no se promete otra cosa)", () => {
      const precio = html.match(/<section id="precio"[\s\S]*?<\/section>/)![0];
      expect(precio).toContain("14 días de prueba");
      expect(precio).toContain("Sin permanencia");
    });
  });

  describe("T-83: comprobante anotado", () => {
    it("título, texto y las cuatro preguntas que Nexo le hace al comprobante", () => {
      for (const frase of [
        "Le avisamos antes de que despache un pedido mal pagado.",
        "Nexo lee cada comprobante que le mandan y le avisa si algo no cuadra. La decisión siempre es suya.",
        "$40.000",
        "300 000 0000",
        "M4471902",
        "Monto: ¿es el total del pedido?",
        "Cuenta: ¿llegó a la de su negocio?",
        "Referencia: ¿ya se la habían mandado?",
        "Fecha: ¿es de hoy?",
      ]) {
        expect(texto, frase).toContain(frase);
      }
    });

    it("va entre «Lo que se pierde» y «Así funciona»", () => {
      const orden = ["perdidas", "comprobante", "como-funciona"].map((id) => html.indexOf(`id="${id}"`));
      expect(orden.every((i) => i >= 0)).toBe(true);
      expect([...orden].sort((x, y) => x - y)).toEqual(orden);
    });

    it("el comprobante es de ejemplo: sin nombres de bancos", () => {
      const seccion = html.match(/<section id="comprobante"[\s\S]*?<\/section>/)![0];
      expect(seccion).not.toMatch(/Nequi|Bancolombia|Daviplata|Davivienda|BBVA|Banco de/i);
      expect(seccion).toContain("Ejemplo");
    });

    it("es la única tarjeta de la página con borde con brillo", () => {
      expect(html.match(/data-brillo/g)).toHaveLength(1);
    });

    it("las anotaciones se animan con view() solo si el navegador lo soporta y sin «reducir movimiento»", () => {
      const css = readFileSync(join(__dirname, "..", "..", "src/app/globals.css"), "utf8");
      expect(css).toMatch(/@supports \(animation-timeline: view\(\)\) \{\s*@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\.anotacion \{[\s\S]*?animation-timeline: view\(\);/);
    });
  });

  describe("T-85: tarjeta de precio", () => {
    const textoDe = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const seccion = textoDe(html.match(/<section id="precio"[\s\S]*?<\/section>/)![0]);

    it("precio en grande con «Desde» y «al mes», condiciones, qué incluye y la garantía", () => {
      for (const frase of [
        "Desde $79.900 al mes",
        "Instalación gratis en su negocio",
        "14 días de prueba",
        "Sin permanencia",
        "Incluye",
        "Pedidos con total confirmado",
        "Revisión de comprobantes",
        "Pedidos por nota de voz",
        "Citas",
        "Panel de pedidos en el celular",
        "Soporte por WhatsApp",
        GARANTIA,
      ]) {
        expect(seccion, frase).toContain(frase);
      }
      expect(html).toMatch(/font-display[^"]*text-\[56px\][^"]*sm:text-\[72px\][^>]*>\$79\.900</);
    });

    it("la garantía y «sin permanencia» dicen lo mismo que los Términos", () => {
      const terminos = readFileSync(join(__dirname, "terminos", "page.tsx"), "utf8");
      expect(terminos).toContain("Los primeros 14 días son de prueba gratis, sin obligación de continuar.");
      expect(terminos).toContain("No hay permanencia mínima.");
    });

    it("NOTA_PRECIO: sin texto no aparece; con texto, se muestra bajo la lista", () => {
      const sinNota = renderToStaticMarkup(createElement(Precio, { precio: "$79.900", nota: null }));
      const conNota = renderToStaticMarkup(createElement(Precio, { precio: "$79.900", nota: "Los mensajes de WhatsApp de Meta van aparte." }));
      expect(sinNota).not.toContain("van aparte");
      expect(conNota).toContain("Los mensajes de WhatsApp de Meta van aparte.");
      expect(conNota.indexOf("Soporte por WhatsApp")).toBeLessThan(conNota.indexOf("van aparte"));
    });

    it("sin precio se conserva el texto de cupos", () => {
      const sinPrecio = textoDe(renderToStaticMarkup(createElement(Precio, { precio: null })));
      expect(sinPrecio).toContain("Instalamos pocos negocios al mes porque lo hacemos en persona. Pregúntenos por los cupos.");
      expect(sinPrecio).not.toContain("Incluye");
    });
  });

  describe("T-84: lo que se pierde", () => {
    const seccion = html.match(/<section id="perdidas"[\s\S]*?<\/section>/)![0];
    const textoSeccion = seccion.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    it("el chat sin responder, con sus horas, y nadie que lo vio", () => {
      for (const frase of [
        "¿Todavía tienen domicilio?",
        "9:52 p. m.",
        "¿Hola?",
        "10:15 p. m.",
        "Ya pedí en otro lado.",
        "10:31 p. m.",
        "Visto por última vez: nadie.",
      ]) {
        expect(textoSeccion, frase).toContain(frase);
      }
      // Las horas van en Sora (font-display), como el resto de horas y precios.
      expect(seccion.match(/<time class="[^"]*font-display/g)).toHaveLength(3);
    });

    it("las tres frases van solas: sin tarjetas ni iconos", () => {
      expect(textoSeccion).toContain("El total mal sumado en plena hora pico.");
      expect(textoSeccion).toContain("El comprobante que ya le habían mandado antes.");
      expect(seccion).not.toContain("<svg");
      expect(seccion).not.toContain("rounded-2xl");
    });

    it("sin cifras ni estadísticas: los únicos números son las horas del chat", () => {
      const sinHoras = textoSeccion.replace(/\d{1,2}:\d{2} p\. m\./g, "");
      expect(sinHoras).not.toMatch(/\d/);
    });
  });
});
