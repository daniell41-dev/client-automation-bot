/**
 * Validación del `BusinessConfig` que viene de la base de datos.
 *
 * El JSONB de `negocios.config` (y el `template` de los rubros) lo editan
 * humanos desde el portal/back office: antes de dárselo al motor hay que
 * validar su forma. Espejo en Zod de los tipos de `core/types.ts`.
 */

import { z } from "zod";
import type { BusinessConfig } from "@/core/types";

const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  price: z.number().nonnegative(),
  durationMinutes: z.number().positive(),
  keywords: z.array(z.string()).optional(),
});

const messagesSchema = z.object({
  welcome: z.string(),
  askName: z.string(),
  askDate: z.string(),
  askConfirm: z.string(),
  serviceInfo: z.string(),
  captured: z.string(),
  fallback: z.string(),
});

const followUpSchema = z.object({
  threshold: z.enum(["2h", "1d", "3d"]),
  afterMinutes: z.number().positive(),
  message: z.string(),
});

const personaSchema = z.object({
  name: z.string().min(1),
  tone: z.string(),
  language: z.string(),
});

export const businessConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug en kebab-case"),
  name: z.string().min(1),
  currency: z.string().min(1),
  locale: z.string().optional(),
  services: z.array(serviceSchema).min(1),
  messages: messagesSchema,
  followUps: z.array(followUpSchema),
  bookingUrl: z.string().optional(),
  timezone: z.string().optional(),
  personas: z
    .object({
      whatsapp: personaSchema.optional(),
      instagram: personaSchema.optional(),
      mock: personaSchema.optional(),
    })
    .optional(),
  // Almacenamiento propio del negocio (multi-tenant sin Supabase).
  storage: z
    .object({
      spreadsheetId: z.string().optional(),
      calendarId: z.string().optional(),
    })
    .optional(),
});

/**
 * Parsea un JSON desconocido a `BusinessConfig`, o `null` si es inválido
 * (se registra el motivo; el llamador decide el fallback).
 */
export function parseBusinessConfig(json: unknown): BusinessConfig | null {
  const result = businessConfigSchema.safeParse(json);
  if (!result.success) {
    console.warn("[config-schema] BusinessConfig inválido:", result.error.message);
    return null;
  }
  return result.data as BusinessConfig;
}
