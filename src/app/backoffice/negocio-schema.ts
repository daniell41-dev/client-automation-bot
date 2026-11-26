/**
 * Validación de los formularios de negocio del back office (T-12).
 *
 * Mismo objeto Zod en el cliente (`nuevo-negocio-form.tsx`,
 * `negocios/[id]/page.tsx`) y en el servidor (`actions.ts`) — nunca dos
 * definiciones que puedan desalinearse. No confundir con
 * `core/config-schema.ts`: eso valida el `BusinessConfig` (JSONB); esto
 * valida los campos propios de la fila `negocios` (dueño, rubro, WhatsApp).
 */

import { z } from "zod";
import { SLUG_RE } from "@/core/config-schema";
import { PLANES } from "@/core/planes";
import { textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (acciones.negocioSchema). */
const tt = textos.acciones.negocioSchema;

export const crearNegocioSchema = z.object({
  nombre: z.string().min(1, tt.elNombreEsObligatorio),
  slug: z.string().regex(SLUG_RE, tt.elSlugDebeIr),
  owner_id: z.string().min(1, tt.elijaUnClienteDueno),
  rubro_id: z.string().min(1, tt.elijaUnRubro),
  whatsapp_phone_number_id: z.string().optional(),
  // T-127: los tres planes de `core/planes.ts` (columna `negocios.plan`).
  plan: z.enum(PLANES),
});

export const actualizarNegocioSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1, tt.elNombreEsObligatorio),
  owner_id: z.string().min(1, tt.elijaUnClienteDueno),
  whatsapp_phone_number_id: z.string().optional(),
  plan: z.enum(PLANES),
});
