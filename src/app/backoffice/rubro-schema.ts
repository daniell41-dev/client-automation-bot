/**
 * Validación del formulario de rubro del back office.
 *
 * Mismo criterio que `negocio-schema.ts`: esto valida los campos propios de la
 * fila `rubros` (slug, nombre, descripción), no el `BusinessConfig` que va en
 * la columna `template` — de eso se encarga `businessConfigSchema`
 * (`core/config-schema.ts`).
 *
 * El `slug` se valida contra `SLUG_RE`, el mismo regex que exige
 * `businessConfigSchema`, y no contra una copia local: el rubro nace con una
 * plantilla que lleva ese slug adentro, así que un slug que acá pase y allá no
 * produce un rubro que solo falla más tarde, al crear el negocio.
 */

import { z } from "zod";
import { SLUG_RE } from "@/core/config-schema";

export const crearRubroSchema = z.object({
  slug: z.string().regex(SLUG_RE, "El slug debe ir en kebab-case (ej. barberia)."),
  nombre: z.string().min(1, "El nombre es obligatorio."),
  descripcion: z.string().optional(),
});
