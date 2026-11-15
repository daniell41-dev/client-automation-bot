/**
 * T-79: lo mismo que `src/core/sin-voseo.test.ts`, pero para las pantallas
 * (portal, back office, login, demo, errores, toasts y validaciones). Ahí no
 * hay un flujo que recorrer: se leen los archivos de `src/app` y
 * `src/components` y se revisan sus textos.
 *
 * Solo cadenas y texto de JSX, nunca comentarios. Para eso se usa el parser
 * de TypeScript en vez de un grep: un comentario puede explicar el voseo
 * ("antes decía «Tocá Aprobar»") sin que lo vea nadie en pantalla.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { buscarVoseo } from "@/core/formas-voseo";

const RAIZ = join(__dirname, "..");
const CARPETAS = ["src/app", "src/components"];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    // Los .ts también: ahí viven los toasts de las Server Actions y los mensajes de Zod.
    return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

/** Cadenas, plantillas y texto de JSX de un archivo, sin comentarios. */
function textosDe(ruta: string): string[] {
  const fuente = ts.createSourceFile(
    ruta,
    readFileSync(ruta, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ruta.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const textos: string[] = [];
  const visitar = (nodo: ts.Node) => {
    if (
      ts.isStringLiteral(nodo) ||
      ts.isNoSubstitutionTemplateLiteral(nodo) ||
      ts.isTemplateHead(nodo) ||
      ts.isTemplateMiddle(nodo) ||
      ts.isTemplateTail(nodo) ||
      ts.isJsxText(nodo)
    ) {
      textos.push(nodo.text);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return textos;
}

describe("sin voseo en las pantallas (T-79)", () => {
  const todos = CARPETAS.flatMap((c) => archivos(join(RAIZ, c)));

  it("encuentra los archivos (si no, el test pasaría sin revisar nada)", () => {
    expect(todos.length).toBeGreaterThan(50);
  });

  it.each(todos.map((ruta) => [relative(RAIZ, ruta), ruta]))("%s", (_nombre, ruta) => {
    expect(buscarVoseo(textosDe(ruta))).toEqual([]);
  });
});
