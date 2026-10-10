/**
 * Alta del negocio por la propia dueña (T-42): funciones puras, testeadas
 * aparte de la Server Action.
 */

import type { BusinessConfig } from "@/core/types";

/**
 * Slug a partir del nombre: "Sabores del Sur" → "sabores-del-sur". La dueña
 * no tiene por qué saber qué es un slug; si ya existe, la action le agrega
 * un sufijo.
 */
export function slugDesdeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Config del negocio nuevo copiada de la plantilla del rubro. Nace con el
 * bot APAGADO: no tiene número conectado todavía, y lo enciende el admin
 * cuando conecta el WhatsApp (decisión del plan, T-42).
 */
export function configDesdePlantilla(plantilla: BusinessConfig, nombre: string, slug: string): BusinessConfig {
  return { ...plantilla, slug, name: nombre, botActivo: false };
}
