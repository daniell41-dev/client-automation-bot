/**
 * T-116: lector de CSV mínimo, sin librerías (regla 3: el core no importa
 * SDKs). Cubre lo que de verdad llega de Excel y de Tienda Nube: separador
 * `;` (Excel en español) o `,`, comillas con `;` o saltos de línea adentro,
 * comillas dobles escapadas (`""`), CRLF y el BOM de UTF-8.
 *
 * Recibe TEXTO: decodificar los bytes (UTF-8 o Windows-1252, que es lo que
 * exporta Tienda Nube) es del adaptador del navegador, que tiene `TextDecoder`.
 */

export interface TablaCsv {
  encabezados: string[];
  /** Cada fila con el mismo largo que `encabezados` (se rellena con ""). */
  filas: string[][];
}

/** El separador que más aparece en la primera línea (fuera de comillas). */
function detectarSeparador(primeraLinea: string): string {
  const candidatos = [";", ",", "\t"];
  let mejor = ";";
  let max = -1;
  for (const c of candidatos) {
    let n = 0;
    let enComillas = false;
    for (const ch of primeraLinea) {
      if (ch === '"') enComillas = !enComillas;
      else if (ch === c && !enComillas) n++;
    }
    if (n > max) {
      max = n;
      mejor = c;
    }
  }
  return mejor;
}

export function parsearCsv(texto: string): TablaCsv {
  const limpio = texto.replace(/^﻿/, "");
  const sep = detectarSeparador(limpio.split(/\r?\n/, 1)[0] ?? "");
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i];
    if (enComillas) {
      if (ch === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += ch;
      }
    } else if (ch === '"') {
      enComillas = true;
    } else if (ch === sep) {
      fila.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += ch;
    }
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  // Las filas completamente vacías (líneas en blanco al final de Excel) no cuentan.
  const conDatos = filas.filter((f) => f.some((c) => c.trim() !== ""));
  const [encabezados = [], ...resto] = conDatos;
  const ancho = encabezados.length;
  return {
    encabezados: encabezados.map((e) => e.trim()),
    filas: resto.map((f) => (f.length >= ancho ? f.slice(0, ancho) : [...f, ...Array(ancho - f.length).fill("")])),
  };
}
