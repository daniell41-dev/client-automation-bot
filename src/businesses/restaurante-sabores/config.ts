/**
 * Negocio de prueba: "Sabores del Sur" (rubro restaurante).
 *
 * Usado para verificar el aislamiento multi-tenant: cada negocio escribe SOLO
 * en su propia planilla de Google Sheets.
 *
 * ANTES DE CORRER sheets:doctor:
 *   1. Creá una planilla nueva en Google Sheets (vacía).
 *   2. Compartila (Editor) con el GOOGLE_SERVICE_ACCOUNT_EMAIL del .env.local.
 *   3. Reemplazá el spreadsheetId en `storage` con el ID de esa planilla.
 *   pnpm sheets:doctor --business restaurante-sabores
 */

import type { BusinessConfig } from "@/core/types";

export const restauranteSabores: BusinessConfig = {
  slug: "restaurante-sabores",
  name: "Sabores del Sur",
  currency: "COP",
  locale: "es-CO",

  services: [
    {
      id: "reserva-mesa",
      name: "Reserva de mesa",
      description: "Reservá tu mesa para cenar tranquilo sin esperas. Capacidad para grupos de 2 a 10 personas.",
      price: 0,
      durationMinutes: 90,
      keywords: ["reserva", "mesa", "cenar", "cena", "almorzar", "almuerzo", "lugar", "puesto"],
    },
    {
      id: "delivery",
      name: "Delivery",
      description: "Pedí nuestros platos a domicilio. Entrega en 40-60 minutos dentro del área de cobertura.",
      price: 8000,
      durationMinutes: 60,
      keywords: ["delivery", "domicilio", "pedido", "traer", "enviar", "llevar"],
    },
    {
      id: "eventos",
      name: "Eventos y catering",
      description: "Organizamos tu evento privado o empresarial. Menú personalizado, decoración y servicio completo.",
      price: 500000,
      durationMinutes: 240,
      keywords: ["evento", "catering", "cumpleaños", "empresa", "privado", "reunion", "celebracion"],
    },
  ],

  messages: {
    welcome:
      "¡Hola! Bienvenido a Sabores del Sur 🍽️ ¿En qué te podemos ayudar?\n" +
      "1. Reserva de mesa\n2. Delivery\n3. Eventos y catering",
    askName:
      "¡Con gusto! Para continuar, ¿cuál es tu nombre? 😊",
    askDate: "Perfecto {{nombre}} 🍽️ ¿Para qué día y hora te gustaría?",
    askConfirm:
      "¿Te confirmo {{servicio}} para {{fecha}}, {{nombre}}? 🍽️",
    serviceInfo:
      "{{servicio}}: {{descripcion}}\nTiempo estimado: {{duracion}}.\nCosto: {{precio}}.",
    captured:
      "¡Listo {{nombre}}! ✅ Tu {{servicio}} para {{fecha}} quedó registrada.\n" +
      "¡Te esperamos en Sabores del Sur! 🍽️ {{agenda}}",
    fallback:
      "Disculpá, no te entendí 😅. ¿Te puedo ayudar con alguno de estos?\n" +
      "1. Reserva de mesa\n2. Delivery\n3. Eventos y catering",
  },

  followUps: [
    {
      threshold: "2h",
      afterMinutes: 120,
      message:
        "Hola {{nombre}}, vimos que estabas interesado en {{servicio}}. " +
        "¿Querés que te cuente la disponibilidad para esta semana?",
    },
    {
      threshold: "1d",
      afterMinutes: 1440,
      message:
        "¡Tenemos mesa disponible para {{servicio}} esta semana! " +
        "Confirmá tu lugar antes de que se llene 🍽️",
    },
    {
      threshold: "3d",
      afterMinutes: 4320,
      message:
        "Último aviso 😊 ¿Querés que te avisemos cuando haya promos especiales de {{servicio}}?",
    },
  ],

  // bookingUrl: "https://calendly.com/sabores-del-sur", // opcional

  personas: {
    whatsapp: {
      name: "Carlos",
      tone:
        "Warm, welcoming and professional. Use light food emojis (🍽️✅😊) naturally. Be concise and friendly. Address the client by name when available.",
      language: "español colombiano informal",
    },
  },

  storage: {
    // Reemplazá este valor con el ID de la planilla de Google Sheets del restaurante.
    // El ID está en la URL: https://docs.google.com/spreadsheets/d/<ESTE_ID>/edit
    spreadsheetId: "1_Qq9WzFogsRZ6ZhQ6upgP1RqwLFCQSnyNE6UqnsTagI",
  },
};
