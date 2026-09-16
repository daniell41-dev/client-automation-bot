/**
 * Esquema (Zod) de lo que un modelo con visión devuelve al describir una foto
 * del cliente (T-23.3).
 *
 * A propósito NO tiene un campo "producto" ni "disponible": el modelo solo
 * describe lo que VE (tipo, marca, texto visible). Cruzarlo contra el
 * catálogo real es trabajo de `buscar-producto.ts` (T-23.4) — nunca del
 * modelo, que no conoce el inventario del negocio y podría alucinar un match.
 */

import { z } from "zod";

export const imageDescriptionSchema = z.object({
  /** Qué tipo de producto parece ser (p. ej. "aceite de cocina", "champú"). */
  tipoProducto: z.string().min(1),
  marca: z.string().optional(),
  /** Texto que se alcanza a leer en el empaque/etiqueta, tal cual aparece. */
  textoVisible: z.array(z.string()).default([]),
  categoria: z.string().optional(),
  /**
   * `true` si la imagen muestra una receta/fórmula médica — dispara el
   * bloqueo duro de farmacia en `handle.ts` (T-23.5, decisión §1.4 del plan:
   * no se procesa, se pide hablar con la dueña). Ante la duda, `true`.
   */
  esRecipeMedico: z.boolean(),
  confianza: z.enum(["alta", "media", "baja"]),
});

export type ImageDescription = z.infer<typeof imageDescriptionSchema>;
