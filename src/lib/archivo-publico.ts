/**
 * T-86: ¿existe este archivo en `public/`? Lo usan las piezas opcionales de la
 * landing (el video del hero, la foto del responsable): si alguien sube el
 * archivo, aparece en el próximo build; mientras no exista, no se muestra nada
 * roto. Se revisa al compilar porque la página es estática.
 *
 * `ruta` es la URL pública ("/landing/demo.mp4"), igual que en el src.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export function existeEnPublic(ruta: string, raiz: string = process.cwd()): boolean {
  // Una ruta con ".." podría apuntar fuera de public/: no se acepta.
  if (ruta.split("/").includes("..")) return false;
  return existsSync(join(raiz, "public", ruta));
}
