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

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const crearNegocioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  slug: z.string().regex(SLUG_RE, "El slug debe ir en kebab-case (ej. mi-negocio)."),
  owner_id: z.string().min(1, "Elegí un cliente dueño."),
  rubro_id: z.string().min(1, "Elegí un rubro."),
  whatsapp_phone_number_id: z.string().optional(),
  plan: z.enum(["free", "pro"]),
});

export const actualizarNegocioSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1, "El nombre es obligatorio."),
  owner_id: z.string().min(1, "Elegí un cliente dueño."),
  whatsapp_phone_number_id: z.string().optional(),
  plan: z.enum(["free", "pro"]),
});
