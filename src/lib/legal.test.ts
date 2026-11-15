import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CONTACTO_LEGAL } from "@/lib/legal";
import Privacidad from "@/app/privacidad/page";
import Terminos from "@/app/terminos/page";
import EliminarDatos from "@/app/eliminar-datos/page";

const paginas = { privacidad: Privacidad, terminos: Terminos, "eliminar-datos": EliminarDatos };

describe("contacto legal", () => {
  it("publica un solo teléfono, el del responsable", () => {
    expect(CONTACTO_LEGAL.telefonos).toEqual(["+57 322 683 7610"]);
  });

  it.each(Object.entries(paginas))("/%s no muestra el número retirado", (_, Pagina) => {
    const html = renderToStaticMarkup(createElement(Pagina));
    expect(html).not.toContain("313 830 6315");
  });

  it("las páginas que dan un teléfono dan el del responsable", () => {
    for (const Pagina of [Privacidad, EliminarDatos]) {
      expect(renderToStaticMarkup(createElement(Pagina))).toContain("+57 322 683 7610");
    }
  });
});
