/**
 * Negocio de ejemplo: "Estética Bella" (rubro estética/belleza).
 *
 * Esto es SOLO datos. Demuestra el eje de personalización por rubro: para vender
 * a otro negocio se copia `_template`, se ajustan estos valores y se registra el
 * slug — sin tocar `core/`.
 */

import type { BusinessConfig } from "@/core/types";

export const esteticaBella: BusinessConfig = {
  slug: "estetica-bella",
  name: "Estética Bella",
  currency: "COP",
  locale: "es-CO",

  services: [
    {
      id: "limpieza-facial",
      name: "Limpieza facial",
      description:
        "Limpieza profunda: limpieza, exfoliación, extracción, mascarilla y protección final.",
      price: 120000,
      durationMinutes: 60,
      keywords: ["facial", "limpieza", "piel", "cara"],
    },
    {
      id: "unas",
      name: "Uñas",
      description: "Manicure semipermanente con esmaltado de larga duración.",
      price: 60000,
      durationMinutes: 45,
      keywords: ["unas", "manicure", "esmaltado", "semipermanente"],
    },
    {
      id: "pestanas",
      name: "Pestañas",
      description: "Lifting de pestañas para una mirada definida y natural.",
      price: 90000,
      durationMinutes: 75,
      keywords: ["pestanas", "lifting", "extensiones", "mirada"],
    },
    {
      id: "depilacion",
      name: "Depilación",
      description: "Depilación con cera de alta calidad, por zonas.",
      price: 45000,
      durationMinutes: 30,
      keywords: ["depilacion", "cera", "wax"],
    },
  ],

  messages: {
    welcome:
      "¡Hola! Gracias por escribirnos 💜 ¿Qué servicio te interesa?\n" +
      "1. Limpieza facial\n2. Uñas\n3. Pestañas\n4. Depilación",
    askName:
      "¡Perfecto! Para ayudarte mejor, ¿cuál es tu nombre? 😊",
    askDate: "Genial {{nombre}} 💜 ¿Qué día te gustaría agendar?",
    askConfirm:
      "¿Te confirmo tu cita de {{servicio}} para {{fecha}}, {{nombre}}? 💜",
    serviceInfo:
      "Nuestra {{servicio}} incluye: {{descripcion}}\n" +
      "Duración: {{duracion}}.\nPrecio: {{precio}}.",
    captured:
      "¡Listo {{nombre}}! ✨ Tu cita de {{servicio}} para {{fecha}} quedó agendada.\n" +
      "Te esperamos 💜 {{agenda}}",
    fallback:
      "Disculpa, no te entendí 😅. ¿Qué servicio te interesa?\n" +
      "1. Limpieza facial\n2. Uñas\n3. Pestañas\n4. Depilación",
  },

  followUps: [
    {
      threshold: "2h",
      afterMinutes: 120,
      message:
        "Hola {{nombre}}, vi que estabas interesada en {{servicio}}. " +
        "¿Quieres que te comparta horarios disponibles para esta semana?",
    },
    {
      threshold: "1d",
      afterMinutes: 1440,
      message:
        "Tenemos algunos cupos disponibles esta semana para {{servicio}}. " +
        "También puedes separar tu cita con un anticipo 💜",
    },
    {
      threshold: "3d",
      afterMinutes: 4320,
      message:
        "Último mensaje para no molestarte 😊 ¿Te gustaría que te avisemos " +
        "cuando haya promoción de {{servicio}}?",
    },
  ],

  // bookingUrl: "https://calendly.com/estetica-bella", // opcional
  timezone: "America/Bogota",

  personas: {
    whatsapp: {
      name: "Isabella",
      tone:
        "Warm, feminine and friendly. Use light emojis (💜✨😊) naturally but not excessively. Be concise. Always address the client by name when available.",
      language: "español colombiano informal",
    },
    instagram: {
      name: "Bella",
      tone:
        "Fun, trendy and energetic. Use emojis more freely (💅✨🌸💖). Short sentences. Use 'amiga' when addressing female clients. Keep it fresh and youthful.",
      language: "español colombiano informal y juvenil",
    },
  },

  storage: {
    spreadsheetId: "1QKcZUaYzhK_98ZyhEDOz3JwTcNR4lyQM9FMj1fjQRco",
    // Calendar ID de la dueña (su calendario principal). El calendario está
    // compartido con el GOOGLE_SERVICE_ACCOUNT_EMAIL con permiso
    // "Hacer cambios en los eventos".
    calendarId: "daniellvalero41@gmail.com",
  },
};
