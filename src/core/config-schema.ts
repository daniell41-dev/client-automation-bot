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
export const serviceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1, "El nombre es obligatorio."),
    description: z.string(),
    price: z.number().nonnegative("El precio no puede ser negativo."),
    // T-21: opcional — una harina no dura nada. La regla de "cuándo SÍ es
    // obligatoria" está en el superRefine de abajo.
    durationMinutes: z.number().positive().optional(),
    keywords: z.array(z.string()).optional(),
    categoria: z.string().optional(),
    disponible: z.boolean().optional(),
    reservable: z.boolean().optional(),
    modo: z.enum(["cita", "pedido"]).optional(),
    stock: z.number().int().nonnegative("El stock no puede ser negativo.").optional(),
  })
  .superRefine((item, ctx) => {
    // Un ítem que se agenda SÍ necesita duración: `buildCalendarEvent` calcula
    // el fin del evento con ella y `validarCita` la usa para saber si entra
    // antes del cierre. Sin ella, el evento duraría cero.
    //
    // Solo se exige cuando el ítem declara por sí mismo que es una cita
    // (`modo` explícito o el `reservable` de siempre). Cuando el camino sale
    // del rubro (`catalogo.modoPorDefecto`), este schema no tiene ese dato a
    // la vista — el motor tolera la ausencia y el editor del portal es quien
    // pide el campo cuando el rubro lo muestra.
    const esCitaPorSiMismo = item.modo === "cita" || (!item.modo && item.reservable === true);
    if (esCitaPorSiMismo && item.durationMinutes === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Un servicio que se agenda necesita una duración.",
      });
    }
  });

/** Forma del catálogo del rubro (T-21). Ver `CatalogoConfig` en `core/types.ts`. */
const catalogoSchema = z.object({
  etiqueta: z
    .object({
      singular: z.string().min(1),
      plural: z.string().min(1),
    })
    .optional(),
  modoPorDefecto: z.enum(["cita", "pedido"]).optional(),
  campos: z
    .object({
      duracion: z.boolean().optional(),
      stock: z.boolean().optional(),
      categoria: z.boolean().optional(),
    })
    .optional(),
  // T-22.2: entero no negativo — 0 es válido (avisar recién cuando se agota).
  stockMinimo: z.number().int().nonnegative().optional(),
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

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const tramoSchema = z.object({
  desde: z.string().regex(HORA_RE, "hora HH:MM"),
  hasta: z.string().regex(HORA_RE, "hora HH:MM"),
});

const diaAtencionSchema = z.object({
  /** 0 = domingo … 6 = sábado, igual que `Date.getDay()`. */
  dow: z.number().int().min(0).max(6),
  abierto: z.boolean(),
  tramos: z.array(tramoSchema),
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
  citaVigente: z.string().optional(),
  askCantidad: z.string().optional(),
  askConfirmPedido: z.string().optional(),
  esperandoAprobacion: z.string().optional(),
  pedidoConfirmado: z.string().optional(),
  pedidoRechazado: z.string().optional(),
  pedidoVigente: z.string().optional(),
  pedirComprobante: z.string().optional(),
});

/** T-24.4 — sin esto (default), el flujo de aprobación de pedidos no cambia. */
const pagosSchema = z.object({
  requiereComprobante: z.boolean().optional(),
  telefonoDestino: z.string().optional(),
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
  // T-21: tiene que estar declarado acá o Zod lo descarta EN SILENCIO al
  // parsear (el repo no usa `.strict()` ni `.passthrough()`), y el bloque se
  // perdería entre la plantilla del rubro y el config del negocio sin que
  // nadie se entere. Es la trampa que ya anotaba la sección 2.4 del plan.
  catalogo: catalogoSchema.optional(),
  messages: messagesSchema,
  followUps: z.array(followUpSchema),
  bookingUrl: z.string().optional(),
  timezone: z.string().optional(),
  direccion: z.string().optional(),
  botActivo: z.boolean().optional(),
  plan: z.enum(["free", "pro"]).optional(),
  // T-20: `.catch(undefined)` en vez de invalidar el config entero — un
  // horario mal formado (o en el formato viejo de texto libre, pre-T-20)
  // nunca debe tumbar al negocio al registry estático. Sin horarios
  // válidos, el bot simplemente no valida citas contra ellos (como si no
  // los tuviera cargados).
  horarios: z.array(diaAtencionSchema).optional().catch(undefined),
  ai: aiSchema.optional(),
  pedidos: pedidosSchema.optional(),
  notifyPhoneNumber: z.string().optional(),
  pagos: pagosSchema.optional(),
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
