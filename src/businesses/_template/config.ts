/**
 * PLANTILLA para un negocio nuevo.
 *
 * Cómo usarla:
 *   1. Copia esta carpeta:  cp -r src/businesses/_template src/businesses/<slug>
 *   2. Ajusta los valores de abajo (servicios, precios, mensajes, seguimientos).
 *   3. Registra el negocio en `src/businesses/registry.ts`.
 *   4. Pruébalo:  pnpm sim "Hola" --business <slug>
 *
 * Reglas:
 *   - Esto es SOLO datos. No agregues lógica aquí.
 *   - No modifiques nada en `core/` para personalizar un negocio.
 *
 * Variables disponibles en las plantillas de mensajes:
 *   {{nombre}} {{servicio}} {{fecha}} {{negocio}} {{agenda}}
 *   En `serviceInfo` además: {{descripcion}} {{precio}} {{duracion}}
 */

import type { BusinessConfig } from "@/core/types";

export const plantilla: BusinessConfig = {
  slug: "mi-negocio", // identificador en kebab-case
  name: "Mi Negocio",
  currency: "COP",
  locale: "es-CO",

  services: [
    {
      id: "servicio-1",
      name: "Servicio 1",
      description: "Describe qué incluye el servicio.",
      price: 100000,
      durationMinutes: 60,
      keywords: ["palabra1", "palabra2"], // para detectarlo en texto libre
    },
    // Agrega más servicios aquí…
  ],

  messages: {
    welcome: "¡Hola! ¿Qué servicio te interesa?",
    askName: "Para ayudarte mejor, ¿cuál es tu nombre?",
    askDate: "{{nombre}}, ¿qué día te gustaría agendar?",
    serviceInfo:
      "{{servicio}}: {{descripcion}}\nDuración: {{duracion}}.\nPrecio: {{precio}}.",
    captured:
      "¡Listo {{nombre}}! Anotamos {{servicio}} para {{fecha}}. {{agenda}}",
    fallback: "No te entendí 😅. ¿Qué servicio te interesa?",
  },

  followUps: [
    { threshold: "2h", afterMinutes: 120, message: "Hola {{nombre}}, ¿te comparto horarios de {{servicio}}?" },
    { threshold: "1d", afterMinutes: 1440, message: "Tenemos cupos para {{servicio}} esta semana." },
    { threshold: "3d", afterMinutes: 4320, message: "Último mensaje 😊 ¿Te aviso de promos de {{servicio}}?" },
  ],

  // bookingUrl: "https://calendly.com/tu-negocio", // opcional
};
