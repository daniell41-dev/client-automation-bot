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
      categoria: "General", // categoría visible en el catálogo del portal
      disponible: true, // en false, el bot no lo ofrece (toggle del portal)
      reservable: true, // aparece en "Servicios reservables" (citas)
    },
    // Agrega más servicios aquí…
  ],

  messages: {
    welcome: "¡Hola! ¿Qué servicio te interesa?",
    askName: "Para ayudarte mejor, ¿cuál es tu nombre?",
    askDate: "{{nombre}}, ¿qué día te gustaría agendar?",
    askConfirm: "¿Te confirmo tu cita de {{servicio}} para {{fecha}}, {{nombre}}?",
    serviceInfo:
      "{{servicio}}: {{descripcion}}\nDuración: {{duracion}}.\nPrecio: {{precio}}.",
    captured:
      "¡Listo {{nombre}}! Tu cita de {{servicio}} para {{fecha}} quedó agendada. {{agenda}}",
    fallback: "No te entendí 😅. ¿Qué servicio te interesa?",
  },

  followUps: [
    { threshold: "2h", afterMinutes: 120, message: "Hola {{nombre}}, ¿te comparto horarios de {{servicio}}?" },
    { threshold: "1d", afterMinutes: 1440, message: "Tenemos cupos para {{servicio}} esta semana." },
    { threshold: "3d", afterMinutes: 4320, message: "Último mensaje 😊 ¿Te aviso de promos de {{servicio}}?" },
  ],

  // bookingUrl: "https://calendly.com/tu-negocio", // opcional
  // direccion: "Calle 1 #2-34, Ciudad", // visible en Configuración del portal
  // botActivo: true, // en false el bot queda en pausa (toggle de la topbar)

  // Horarios de atención (sección "Citas y reservas" del portal).
  // horarios: [
  //   { dia: "Lunes a viernes", desde: "09:00", hasta: "20:00", abierto: true },
  //   { dia: "Sábado", desde: "09:00", hasta: "13:00", abierto: true },
  //   { dia: "Domingo", desde: "00:00", hasta: "00:00", abierto: false },
  // ],

  // Cerebro del bot (sección "Respuestas y flujos" del portal).
  // Las reglas rápidas responden EXACTO por palabra clave, antes que la IA.
  // ai: {
  //   enabled: true,
  //   knowledge: "Describe el negocio: qué vende, cómo cobra, si hace envíos…",
  //   reglas: [
  //     { keywords: ["horario", "abren"], respuesta: "Atendemos de 9 a 20 h." },
  //   ],
  //   botonesMenu: ["Ver servicios", "Agendar"],
  //   derivarHumano: true,
  // },

  // Planilla de Google Sheets propia del negocio (modelo multi-tenant).
  // 1. Creá una planilla nueva en Google Sheets.
  // 2. Compartila (Editor) con el GOOGLE_SERVICE_ACCOUNT_EMAIL del .env.local.
  // 3. Pegá el ID que aparece en la URL: /spreadsheets/d/<ID>/edit
  // storage: {
  //   spreadsheetId: "", // ← pegá el ID acá
  // },

  // Personalización por canal (opcional). Sin esto las respuestas usan las
  // plantillas directamente, sin pasar por IA.
  // personas: {
  //   whatsapp: {
  //     name: "Sofia",
  //     tone: "Friendly and professional. Use light emojis. Address by name.",
  //     language: "español colombiano informal",
  //   },
  //   instagram: {
  //     name: "Sofi",
  //     tone: "Fun and trendy. More emojis. Use 'amiga' with female clients.",
  //     language: "español colombiano informal y juvenil",
  //   },
  // },
};
