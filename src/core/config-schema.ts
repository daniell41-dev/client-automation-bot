/**
 * Validación del `BusinessConfig` que viene de la base de datos.
 *
 * El JSONB de `negocios.config` (y el `template` de los rubros) lo editan
 * humanos desde el portal/back office: antes de dárselo al motor hay que
 * validar su forma. Espejo en Zod de los tipos de `core/types.ts`.
 */

import { z } from "zod";
import type { BusinessConfig } from "@/core/types";

/**
 * Exportado (T-12): el editor de Catálogo del portal valida el mismo objeto
 * Zod en el cliente, antes de enviar, que el que corre en el servidor dentro
 * de `businessConfigSchema` — nunca dos definiciones que puedan desalinearse.
 */
export const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "El nombre es obligatorio."),
  description: z.string(),
  price: z.number().nonnegative("El precio no puede ser negativo."),
  durationMinutes: z.number().positive(),
  keywords: z.array(z.string()).optional(),
  categoria: z.string().optional(),
  disponible: z.boolean().optional(),
  reservable: z.boolean().optional(),
});

/** El catálogo completo: al menos un producto/servicio (igual regla que `businessConfigSchema`). */
export const servicesSchema = z
  .array(serviceSchema)
  .min(1, "Agregá al menos un producto o servicio.");

const quickRuleSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  respuesta: z.string().min(1),
});

const aiSchema = z.object({
  enabled: z.boolean(),
  modo: z.enum(["agente", "guiado"]).optional(),
  knowledge: z.string().optional(),
  reglas: z.array(quickRuleSchema).optional(),
  botonesMenu: z.array(z.string()).optional(),
  derivarHumano: z.boolean().optional(),
});

const hoursSchema = z.object({
  dia: z.string().min(1),
  desde: z.string(),
  hasta: z.string(),
  abierto: z.boolean(),
});

const pedidosSchema = z.object({
  enabled: z.boolean(),
  pregunta: z.string().min(1),
  opciones: z.array(z.string().min(1)).min(2).max(4),
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

/** Exportado (T-12): el editor de Configuración valida el nombre del bot con este mismo schema. */
export const personaSchema = z.object({
  name: z.string().min(1, "El nombre del bot es obligatorio."),
  tone: z.string(),
  language: z.string(),
});

export const businessConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug en kebab-case"),
  name: z.string().min(1),
  rubro: z.string().optional(),
  currency: z.string().min(1),
  locale: z.string().optional(),
  services: servicesSchema,
  messages: messagesSchema,
  followUps: z.array(followUpSchema),
  bookingUrl: z.string().optional(),
  timezone: z.string().optional(),
  direccion: z.string().optional(),
  botActivo: z.boolean().optional(),
  plan: z.enum(["free", "pro"]).optional(),
  horarios: z.array(hoursSchema).optional(),
  ai: aiSchema.optional(),
  pedidos: pedidosSchema.optional(),
  notifyPhoneNumber: z.string().optional(),
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
